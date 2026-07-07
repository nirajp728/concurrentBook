import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
dotenv.config();

let elasticClient = null;

// Look for either standard Elasticsearch or AWS OpenSearch URLs
const searchUrl = process.env.ELASTICSEARCH_URL || process.env.OPENSEARCH_URL;

if (searchUrl) {
  try {
    elasticClient = new Client({
      node: searchUrl,
      maxRetries: 2,
      requestTimeout: 3000,
      // If you secure your AWS OpenSearch cluster with a username/password later, 
      // you can uncomment this block:
      /*
      auth: {
        username: process.env.ELASTIC_USERNAME,
        password: process.env.ELASTIC_PASSWORD
      }
      */
    });

    // Fire off a background ping to actually test the connection on boot
    elasticClient.ping()
      .then(() => console.log('✅ Search Engine (Elasticsearch/OpenSearch) connected.'))
      .catch((err) => {
        console.error('❌ Search Engine ping failed. It may be offline:', err.message);
        // We set it to null so the controller instantly falls back to MongoDB
        elasticClient = null; 
      });

  } catch (error) {
    console.error('Search Engine configuration error:', error.message);
    elasticClient = null;
  }
} else {
  console.warn('⚠️ Search Engine URL missing in .env. Running in local MongoDB fallback mode.');
}

export function getElasticClient() {
  return elasticClient;
}