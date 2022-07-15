import rdfParser from "rdf-parse";
import jsonld from 'jsonld';
import { ReadableWebToNodeStream } from 'readable-web-to-node-stream';
import * as WacAllow from 'wac-allow';

export function getMostRecentWebID() {
  return window.localStorage.getItem('mostRecentWebID');
}

export function setMostRecentWebID(webId) {
  return window.localStorage.setItem('mostRecentWebID', webId);
}

export function setItemFromLocalStorage(key, value) {
  return window.localStorage.setItem(key, value);
}

export function getItemFromLocalStorage(key) {
  return window.localStorage.getItem(key);
}

export function getRDFasJson(url, frame, fetch) {
  if (!fetch) {
    throw new Error('No fetch function is provided.');
  }

  return new Promise(async (resolve, reject) => {
    // mostly taken from ldfetch
    //We like quads, so preference to serializations that we can parse fast with quads
    //Then comes JSON-LD, which is slower to parse
    //Then comes rdf/xml, turtle and n-triples, which we support in a fast manner, but it doesn’t contain named graphs
    //We also support HTML, but that’s really slow
    //We also support N3 and parse it quite fast, but we won’t do anything special with the N3 rules, so put it to low q
    var accept = 'application/trig;q=1.0,application/n-quads,application/ld+json;q=0.9,application/rdf+xml;q=0.8,text/turtle,application/n-triples';

    const myInit = {
      method: 'GET',
      headers: { 'accept': accept },
      mode: 'cors',
      cache: 'default'
    };

    try {
      const response = await fetch(url, myInit);

      if (response.status !== 200) {
        throw new Error(await response.text());
      }

      const quads = [];
      rdfParser.parse(new ReadableWebToNodeStream(response.body), { contentType: response.headers.get('content-type').split(';')[0], baseIRI: response.url })
        .on('data', (quad) => quads.push(quad))
        .on('error', (error) => reject(error))
        .on('end', async () => {
          resolve(await frameFromQuads(quads, frame));
        });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  })
}

export function getPersonName(person) {
  if (person.name) {
    if (Array.isArray(person.name)) {
      return person.name[0]['@value'];
    } else {
      return person.name['@value'];
    }
  } else if (person.givenName) {
    if (Array.isArray(person.givenName)) {
      return person.givenName[0]['@value'] + ' ' + person.familyName[0]['@value']
    } else {
      return person.givenName['@value'] + ' ' + person.familyName['@value'];
    }
  }
}

async function frameFromQuads(quads, frame) {
  var objects = { "@graph": [] };
  var graphs = {};
  for (var triple of quads) {
    let subjectURI = triple.subject.value;
    let objectURI = triple.object.value;
    //Json-LD lib uses underscores when blanknode
    if (triple.subject.termType === 'BlankNode') {
      subjectURI = '_:' + triple.subject.value;
    }
    if (triple.object.termType === 'BlankNode') {
      objectURI = '_:' + triple.object.value;
    }

    if (triple.graph.value && !graphs[triple.graph.value])
      graphs[triple.graph.value] = { "@id": triple.graph.value, "@graph": [] };

    var obj = {
      "@id": subjectURI,
    };
    if (triple.object.termType === 'Literal') {
      obj[triple.predicate.value] = { "@value": triple.object.value };
      if (triple.predicate.language)
        obj[triple.predicate.value]["@language"] = triple.object.language;
      if (triple.object.datatype)
        obj[triple.predicate.value]["@type"] = triple.object.datatype.value;

      if (triple.object.datatype.value === 'http://www.w3.org/2001/XMLSchema#string') {
        obj[triple.predicate.value] = triple.object.value;
      }
    } else if (triple.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      obj["@type"] = objectURI;
    } else {
      obj[triple.predicate.value] = { "@id": objectURI };
    }
    if (!triple.graph.value) {
      objects["@graph"].push(obj);
    } else {
      let graphURI = triple.graph.value;
      if (triple.graph.termType === 'BlankNode') {
        graphURI = '_:' + triple.graph.value;
      }
      graphs[graphURI]["@graph"].push(obj);
    }
  }
  objects["@graph"].push(Object.values(graphs));
  return jsonld.frame(objects, frame);
}
