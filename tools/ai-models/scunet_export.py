# SCUNet (Zhang et al. 2022), re-written in plain torch for a fixed T x T tile,
# so it exports to a simple static ONNX graph. Weights load as tensors only.
# usage: scunet_export.py weights.pth out.onnx [tile]
import sys
import torch
import torch.nn as nn
import torch.nn.functional as F

WS, HEAD = 8, 32


class WMSA(nn.Module):
    def __init__(self, dim, shifted, res):
        super().__init__()
        self.dim, self.shifted, self.heads = dim, shifted, dim // HEAD
        self.embedding_layer = nn.Linear(dim, 3 * dim)
        self.linear = nn.Linear(dim, dim)
        self.relative_position_params = nn.Parameter(torch.zeros(self.heads, 2 * WS - 1, 2 * WS - 1))
        # Shifted windows mix pixels from opposite edges in the last row and column
        # of windows; those pairs are masked out. Kept as a row part plus a column
        # part so the graph stays small.
        n = res // WS
        r = torch.zeros(n, WS, WS, WS, WS)
        if shifted:
            s = WS - WS // 2
            r[-1, :s, :, s:, :] = -1e4
            r[-1, s:, :, :s, :] = -1e4
        self.register_buffer('brow', r.reshape(n, 1, WS * WS, WS * WS), persistent=False)
        self.register_buffer('bcol', r.permute(0, 2, 1, 4, 3).reshape(1, n, WS * WS, WS * WS), persistent=False)

    def rel(self):
        c = torch.tensor([[i, j] for i in range(WS) for j in range(WS)])
        r = c[:, None, :] - c[None, :, :] + WS - 1
        return self.relative_position_params[:, r[..., 0], r[..., 1]]  # h p q

    def forward(self, x):  # b h w c
        b, H, W, C = x.shape
        if self.shifted:
            x = torch.roll(x, (-(WS // 2), -(WS // 2)), (1, 2))
        n1, n2 = H // WS, W // WS
        x = x.reshape(b, n1, WS, n2, WS, C).permute(0, 1, 3, 2, 4, 5).reshape(b, n1 * n2, WS * WS, C)
        qkv = self.embedding_layer(x).reshape(b, n1 * n2, WS * WS, 3 * self.heads, HEAD).permute(3, 0, 1, 2, 4)
        q, k, v = qkv[:self.heads], qkv[self.heads:2 * self.heads], qkv[2 * self.heads:]
        sim = q @ k.transpose(-1, -2) * HEAD ** -0.5  # h b w p q
        sim = sim + self.rel()[:, None, None]
        sim = (sim.reshape(self.heads, b, n1, n2, WS * WS, WS * WS) + self.brow + self.bcol).reshape(self.heads, b, n1 * n2, WS * WS, WS * WS)
        out = sim.softmax(-1) @ v  # h b w p c
        out = out.permute(1, 2, 3, 0, 4).reshape(b, n1 * n2, WS * WS, C)
        out = self.linear(out)
        out = out.reshape(b, n1, n2, WS, WS, C).permute(0, 1, 3, 2, 4, 5).reshape(b, H, W, C)
        if self.shifted:
            out = torch.roll(out, (WS // 2, WS // 2), (1, 2))
        return out


class Block(nn.Module):
    def __init__(self, dim, shifted, res):
        super().__init__()
        self.ln1, self.ln2 = nn.LayerNorm(dim), nn.LayerNorm(dim)
        self.msa = WMSA(dim, shifted, res)
        self.mlp = nn.Sequential(nn.Linear(dim, 4 * dim), nn.GELU(), nn.Linear(4 * dim, dim))

    def forward(self, x):
        x = x + self.msa(self.ln1(x))
        return x + self.mlp(self.ln2(x))


class ConvTransBlock(nn.Module):
    def __init__(self, d, shifted, res):
        super().__init__()
        self.d = d
        self.trans_block = Block(d, shifted, res)
        self.conv1_1 = nn.Conv2d(2 * d, 2 * d, 1)
        self.conv1_2 = nn.Conv2d(2 * d, 2 * d, 1)
        self.conv_block = nn.Sequential(nn.Conv2d(d, d, 3, 1, 1, bias=False), nn.ReLU(), nn.Conv2d(d, d, 3, 1, 1, bias=False))

    def forward(self, x):
        c, t = torch.split(self.conv1_1(x), (self.d, self.d), 1)
        c = self.conv_block(c) + c
        t = self.trans_block(t.permute(0, 2, 3, 1)).permute(0, 3, 1, 2)
        return x + self.conv1_2(torch.cat((c, t), 1))


def stage(d, n, res):
    # Alternating plain and shifted windows; the published model decides "shifted"
    # from a nominal 256 px input, so every stage keeps its shifted blocks.
    return [ConvTransBlock(d, i % 2 == 1, res) for i in range(n)]


class SCUNet(nn.Module):
    def __init__(self, T, dim=64, n=4):
        super().__init__()
        self.m_head = nn.Sequential(nn.Conv2d(3, dim, 3, 1, 1, bias=False))
        self.m_down1 = nn.Sequential(*stage(dim // 2, n, T), nn.Conv2d(dim, 2 * dim, 2, 2, bias=False))
        self.m_down2 = nn.Sequential(*stage(dim, n, T // 2), nn.Conv2d(2 * dim, 4 * dim, 2, 2, bias=False))
        self.m_down3 = nn.Sequential(*stage(2 * dim, n, T // 4), nn.Conv2d(4 * dim, 8 * dim, 2, 2, bias=False))
        self.m_body = nn.Sequential(*stage(4 * dim, n, T // 8))
        self.m_up3 = nn.Sequential(nn.ConvTranspose2d(8 * dim, 4 * dim, 2, 2, bias=False), *stage(2 * dim, n, T // 4))
        self.m_up2 = nn.Sequential(nn.ConvTranspose2d(4 * dim, 2 * dim, 2, 2, bias=False), *stage(dim, n, T // 2))
        self.m_up1 = nn.Sequential(nn.ConvTranspose2d(2 * dim, dim, 2, 2, bias=False), *stage(dim // 2, n, T))
        self.m_tail = nn.Sequential(nn.Conv2d(dim, 3, 3, 1, 1, bias=False))

    def forward(self, x0):
        x1 = self.m_head(x0)
        x2 = self.m_down1(x1)
        x3 = self.m_down2(x2)
        x4 = self.m_down3(x3)
        x = self.m_body(x4)
        x = self.m_up3(x + x4)
        x = self.m_up2(x + x3)
        x = self.m_up1(x + x2)
        return self.m_tail(x + x1)


if __name__ == '__main__':
    T = int(sys.argv[3]) if len(sys.argv) > 3 else 256
    net = SCUNet(T)
    net.load_state_dict(torch.load(sys.argv[1], map_location='cpu', weights_only=True), strict=True)
    net.eval()
    with torch.no_grad():
        torch.onnx.export(net, torch.rand(1, 3, T, T), sys.argv[2], input_names=['input'], output_names=['output'], opset_version=17, dynamo=False, do_constant_folding=False)
    print('ok')
