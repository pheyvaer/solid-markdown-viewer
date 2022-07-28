import {fetch, handleIncomingRedirect, getDefaultSession, login} from '@inrupt/solid-client-authn-browser';
import {
  getItemFromLocalStorage,
  getMostRecentWebID,
  getPersonName,
  getRDFasJson,
  setItemFromLocalStorage,
  setMostRecentWebID
} from "./utils";
import showdown from 'showdown';

let currentMarkdownUrl;
let rootMarkdownUrl;
const DEFAULTS = {
  currentMarkdownUrl: 'https://pheyvaer.pod.knows.idlab.ugent.be/examples/wiki/home',
  rootMarkdownUrl: 'https://pheyvaer.pod.knows.idlab.ugent.be/examples/wiki/home'
}

window.onload = async () => {
  document.getElementById('log-in-btn').addEventListener('click', () => {
    clickLogInBtn()
  });

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  rootMarkdownUrl = urlParams.get('root') || getItemFromLocalStorage('rootMarkdownUrl') || DEFAULTS.rootMarkdownUrl;
  currentMarkdownUrl = urlParams.get('current') || getItemFromLocalStorage('currentMarkdownUrl') || rootMarkdownUrl || DEFAULTS.currentMarkdownUrl;

  setItemFromLocalStorage('currentMarkdownUrl', currentMarkdownUrl);
  setItemFromLocalStorage('rootMarkdownUrl', rootMarkdownUrl);

  document.getElementById('start-markdown').value = currentMarkdownUrl;
  document.getElementById('home').setAttribute('href', createViewerUrl(rootMarkdownUrl, currentMarkdownUrl, rootMarkdownUrl));

  const webIDInput = document.getElementById('webid');
  webIDInput.value = getMostRecentWebID();
  webIDInput.addEventListener("keyup", ({key}) => {
    if (key === "Enter") {
      clickLogInBtn();
    }
  })

  loginAndFetch(null );
};

async function loginAndFetch(oidcIssuer) {
  await handleIncomingRedirect(
    {
      url: window.location.href,
      restorePreviousSession: true,
    }
  );

  // 2. Start the Login Process if not already logged in.
  if (!getDefaultSession().info.isLoggedIn) {
    if (oidcIssuer) {
      document.getElementById('current-user').classList.add('hidden');
      document.getElementById('webid-form').classList.remove('hidden');

      await login({
        oidcIssuer,
        clientId: CLIENT_ID,
        redirectUrl: CLIENT_ID.replace('/id', '')
      });
    } else {
      document.getElementById('webid-form').classList.remove('hidden');
    }
  } else {
    const webid = getDefaultSession().info.webId;
    setQueryParametersAfterLogin();

    const frame = {
      "@context": {
        "@vocab": "http://xmlns.com/foaf/0.1/",
        "knows": "https://data.knows.idlab.ugent.be/person/office/#",
        "schema": "http://schema.org/",
      },
      "@id": webid
    };

    const result = await getRDFasJson(webid, frame, fetch);
    const name = getPersonName(result) || webid;

    document.getElementById('current-user').innerText = 'Welcome ' + name;
    document.getElementById('current-user').classList.remove('hidden');
    // document.getElementById('storage-location-container').classList.remove('hidden');
    document.getElementById('status-message').classList.remove('hidden');
    document.getElementById('webid-form').classList.add('hidden');
    loadMarkdown();
  }
}

async function clickLogInBtn() {
  // Hide no OIDC issuer error
  // document.getElementById('no-oidc-issuer-error').classList.add('hidden');

  // Get web id
  const webId = document.getElementById('webid').value;
  setMostRecentWebID(webId);

  // Get issuer
  const frame = {
    "@context": {
      "@vocab": "http://xmlns.com/foaf/0.1/",
      "knows": "https://data.knows.idlab.ugent.be/person/office/#",
      "schema": "http://schema.org/",
      "solid": "http://www.w3.org/ns/solid/terms#",
      "solid:oidcIssuer": {"@type": "@id"}
    },
    "@id": webId
  };

  const result = await getRDFasJson(webId, frame, fetch);
  const oidcIssuer = result['solid:oidcIssuer'];

  if (Array.isArray(oidcIssuer)) {
    // Ask user to select desired OIDC issuer.
    //showOIDCIssuerForm(oidcIssuer);
    throw new Error('Not implemented yet.');
  }

  // Login and fetch
  if (oidcIssuer) {
    loginAndFetch(oidcIssuer);
  } else {
    document.getElementById('no-oidc-issuer-error').classList.remove('hidden');
  }
}

async function loadMarkdown() {
  const response = await fetch(currentMarkdownUrl);

  if (response.status === 200) {
    const markdown = await response.text();
    const converter = new showdown.Converter({tables: true});
    const html = converter.makeHtml(markdown);
    document.getElementById('markdown-container').innerHTML = html;
    replaceUrlsInMarkdown();
    document.getElementById('status-message').classList.add('hidden');
    document.getElementById('home-container').classList.remove('hidden');
  } else {
    const message = document.getElementById('status-message');

    if (response.status === 401) {
      message.innerHTML = `You don't have access to <a href="${currentMarkdownUrl}">${currentMarkdownUrl}</a>.`;
    } else if (response.status === 404) {
      message.innerHTML = `The resource at <a href="${currentMarkdownUrl}">${currentMarkdownUrl}</a> was not found.`;
    } else {
      message.innerText = `An error occurred (HTTP status code is ${response.status}).`;
    }

    message.classList.remove('hidden');
  }
}

function replaceUrlsInMarkdown() {
  const urls = document.querySelectorAll('#markdown-container a');

  urls.forEach(async url => {
    const href = url.getAttribute('href');
    const fullUrl = (new URL(href, currentMarkdownUrl)).href;

    const response = await fetch(fullUrl,{method: 'HEAD'});
    const contentType = response.headers.get('Content-Type');

    if (contentType && contentType === 'text/markdown') {
      url.setAttribute('href', createViewerUrl(href, currentMarkdownUrl, rootMarkdownUrl));
    } else {
      url.setAttribute('target', '_blank');
    }
  });

  const imgs = document.querySelectorAll('#markdown-container img');

  imgs.forEach(async img => {
    const src = img.getAttribute('src');
    const fullUrl = (new URL(src, currentMarkdownUrl)).href;
    const response = await fetch(fullUrl);
    const blob = await response.blob();
    const dataUrl = await convertBlobToDataUrl(blob);

    img.setAttribute('src', dataUrl);
  });
}

function createViewerUrl(targetUrl, currentUrl, rootUrl) {
  const fullUrl = (new URL(targetUrl, currentUrl)).href;
  return '/?current=' + fullUrl + '&root=' + rootUrl;
}

function setQueryParametersAfterLogin() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  if (!urlParams.get('current') && currentMarkdownUrl !== DEFAULTS.currentMarkdownUrl) {
    urlParams.set('current', currentMarkdownUrl);
  }

  if (!urlParams.get('root') && currentMarkdownUrl !== DEFAULTS.rootMarkdownUrl) {
    urlParams.set('root', rootMarkdownUrl);
  }

  window.history.replaceState(null, null, '?' + urlParams.toString());
}

function convertBlobToDataUrl(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}
