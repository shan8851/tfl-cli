export const JSON_SCHEMA_VERSION = '1';

export const DEFAULT_STATUS_MODES = [
  'tube',
  'overground',
  'dlr',
  'elizabeth-line',
] as const;

export const VALID_STATUS_MODES = [...DEFAULT_STATUS_MODES] as const;

export const VALID_ROUTE_PREFERENCES = [
  'least-time',
  'least-interchange',
  'least-walking',
] as const;

export const VALID_ROUTE_ACCESSIBILITY = [
  'no-requirements',
  'no-solid-stairs',
  'no-escalators',
  'no-elevators',
  'step-free-to-vehicle',
  'step-free-to-platform',
] as const;

export const VALID_ROUTE_DIRECTIONS = ['inbound', 'outbound', 'all'] as const;

export const VALID_ROUTE_MODES = [
  'public-bus',
  'overground',
  'train',
  'tube',
  'coach',
  'dlr',
  'cablecar',
  'tram',
  'river',
  'walking',
  'cycle',
  'national-rail',
  'elizabeth-line',
] as const;

export const VALID_ROUTE_PREFERENCE_QUERY_VALUES = {
  'least-interchange': 'LeastInterchange',
  'least-time': 'LeastTime',
  'least-walking': 'LeastWalking',
} as const;

export const VALID_ROUTE_ACCESSIBILITY_QUERY_VALUES = {
  'no-elevators': 'NoElevators',
  'no-escalators': 'NoEscalators',
  'no-requirements': 'NoRequirements',
  'no-solid-stairs': 'NoSolidStairs',
  'step-free-to-platform': 'StepFreeToPlatform',
  'step-free-to-vehicle': 'StepFreeToVehicle',
} as const;

export const STATUS_LINE_ALIASES: Record<string, string[]> = {
  bakerloo: ['bakerloo'],
  central: ['central'],
  circle: ['circle'],
  district: ['district'],
  dlr: ['dlr'],
  elizabeth: ['elizabeth'],
  'elizabeth-line': ['elizabeth'],
  'h&c': ['hammersmith-city'],
  'hammersmith and city': ['hammersmith-city'],
  'hammersmith-city': ['hammersmith-city'],
  jubilee: ['jubilee'],
  liberty: ['liberty'],
  lioness: ['lioness'],
  mildmay: ['mildmay'],
  metropolitan: ['metropolitan'],
  northern: ['northern'],
  overground: ['liberty', 'lioness', 'mildmay', 'suffragette', 'weaver', 'windrush'],
  piccadilly: ['piccadilly'],
  suffragette: ['suffragette'],
  victoria: ['victoria'],
  'waterloo & city': ['waterloo-city'],
  'waterloo and city': ['waterloo-city'],
  'waterloo-city': ['waterloo-city'],
  weaver: ['weaver'],
  windrush: ['windrush'],
};

export const RAIL_MODES = new Set([
  'dlr',
  'elizabeth-line',
  'national-rail',
  'overground',
  'tube',
]);

export const STATION_ID_PREFIXES = ['910G', '930G', '940G'] as const;
