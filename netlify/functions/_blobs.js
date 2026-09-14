const { getStore } = require('@netlify/blobs');

// Configurazione esplicita invece dell'auto-rilevamento: più affidabile,
// evita il MissingBlobsEnvironmentError che può presentarsi con getStore(name)
// da solo su alcune configurazioni di deploy.
function viaggiStore() {
  return getStore({
    name: 'viaggi-data',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

module.exports = { viaggiStore };
