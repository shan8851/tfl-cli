import { PostcodeLookupSchema } from '../lib/schemas.js';

import { requestJson } from './requestJson.js';

export type PostcodesClient = {
  lookupPostcode: (postcode: string) => Promise<{
    latitude: number;
    longitude: number;
    postcode: string;
  }>;
};

export const createPostcodesClient = (): PostcodesClient => ({
  lookupPostcode: async (postcode) => {
    const url = new URL(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    const response = await requestJson({
      label: `Postcode lookup for "${postcode}"`,
      schema: PostcodeLookupSchema,
      url,
    });

    return response.result;
  },
});
