import { getDeployStore, getStore } from '@netlify/blobs';

export const RATE_LIMIT_BLOB_FACTORIES = {
    getStoreFn: getStore,
    getDeployStoreFn: getDeployStore,
};
