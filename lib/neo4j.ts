import neo4j, { Driver, Session } from 'neo4j-driver';

if (!process.env.NEO4J_URI) {
  throw new Error('Please add your Neo4j URI to .env.local')
}

if (!process.env.NEO4J_USERNAME) {
  throw new Error('Please add your Neo4j username to .env.local')
}

if (!process.env.NEO4J_PASSWORD) {
  throw new Error('Please add your Neo4j password to .env.local')
}

const uri = process.env.NEO4J_URI;
const username = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;

let driver: Driver;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithNeo4j = global as typeof globalThis & {
    _neo4jDriver?: Driver
  }

  if (!globalWithNeo4j._neo4jDriver) {
    globalWithNeo4j._neo4jDriver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }
  driver = globalWithNeo4j._neo4jDriver;
} else {
  // In production mode, it's best to not use a global variable.
  driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
}

export function getSession(): Session {
  return driver.session();
}

export function closeDriver(): Promise<void> {
  return driver.close();
}

export default driver; 