import { CATALOG } from './gear.js';
import { MY_GEAR, MY_GROUPS } from './mygear.js';

export const buildCatalog = () => ({ version: 1, gear: CATALOG, myGear: MY_GEAR, myGroups: MY_GROUPS });
