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
  document.getElementById('home').addEventListener('click', (e) => {
    e.preventDefault();
    loadMarkdown(getDefaultSession().info.isLoggedIn, rootMarkdownUrl);
  });

  const webIDInput = document.getElementById('webid');
  webIDInput.value = getMostRecentWebID();
  webIDInput.addEventListener("keyup", ({key}) => {
    if (key === "Enter") {
      clickLogInBtn();
    }
  })

  const isLoggedIn = await loginAndFetch(null );
  loadMarkdown(isLoggedIn);
};

/**
 * This function handles the logging in and the fetching of the user information.
 * @param {string} oidcIssuer - The OIDC issuer to log in with.
 * @returns {boolean} True if the login was successful.
 */
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
        clientId: CLIENT_ID,  // eslint-disable-line no-undef
        redirectUrl: CLIENT_ID.replace('/id', '')  // eslint-disable-line no-undef
      });
    } else {
      document.getElementById('webid-form').classList.remove('hidden');
      return false;
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

    document.getElementById('current-user').innerText = `Welcome ${name}!`;
    document.getElementById('current-user').classList.remove('hidden');
    // document.getElementById('storage-location-container').classList.remove('hidden');
    // document.getElementById('status-message').classList.remove('hidden');
    document.getElementById('webid-form').classList.add('hidden');
    await loadMarkdown(true);
    return true;
  }
}

/**
 * This function handles the clicking on the log-in button.
 */
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

/**
 * This method loads the Markdown at currentMarkdownUrl and displays it in the HTML.
 * @param {boolean} isLoggedIn - This boolean is true if the user is logged in.
 * @param {string} markdownUrl - The URL of the Markdown file that needs to be loaded.
 */
async function loadMarkdown(isLoggedIn, markdownUrl = currentMarkdownUrl) {
  const response = await fetch(markdownUrl);

  if (response.status === 200) {
    const markdown = await response.text();
    const converter = new showdown.Converter({tables: true, disableForced4SpacesIndentedSublists: true});
    const html = converter.makeHtml(markdown);
    document.getElementById('markdown-container').innerHTML = html;
    replaceUrlsInMarkdown();
    document.getElementById('status-message').classList.add('hidden');
    if (markdownUrl === rootMarkdownUrl) {
      document.getElementById('home-container').classList.add('hidden');
    } else {
      document.getElementById('home-container').classList.remove('hidden');
    }
    document.getElementById('webid-form').classList.add('hidden');
    document.title = document.querySelector('#markdown-container h1').innerText;
  } else {
    const message = document.getElementById('status-message');

    if (response.status === 401) {
      if (isLoggedIn) {
        message.innerHTML = `You don't have access to <a href="${markdownUrl}">${markdownUrl}</a> with your WebID.`;
      } else {
        message.innerHTML = `You don't have access to <a href="${markdownUrl}">${markdownUrl}</a>. Please log in first.`;
      }

    } else if (response.status === 404) {
      message.innerHTML = `The resource at <a href="${markdownUrl}">${markdownUrl}</a> was not found.`;
    } else {
      message.innerText = `An error occurred (HTTP status code is ${response.status}).`;
    }

    message.classList.remove('hidden');
  }
}

/**
 * This function replaces the URLs in the Markdown text.
 */
function replaceUrlsInMarkdown() {
  const urls = document.querySelectorAll('#markdown-container a');

  urls.forEach(async url => {
    const href = url.getAttribute('href');
    const fullUrl = (new URL(href, currentMarkdownUrl)).href;

    const response = await fetch(fullUrl,{method: 'HEAD'});
    const contentType = response.headers.get('Content-Type');

    if (contentType && contentType === 'text/markdown') {
      url.addEventListener('click', async (e) => {
        e.preventDefault();
        loadMarkdown(getDefaultSession().info.isLoggedIn, fullUrl);
      });
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

/**
 * This function creates a URL for the viewer.
 * @param {string} targetUrl - The target URL of the viewer.
 * @param {string} currentUrl - The current URL of the viewer.
 * @param {string} rootUrl - The root URL of the viewer.
 * @returns {string} The new url for the viewer.
 */
function createViewerUrl(targetUrl, currentUrl, rootUrl) {
  const fullUrl = (new URL(targetUrl, currentUrl)).href;
  return '/?current=' + fullUrl + '&root=' + rootUrl;
}

/**
 * This method sets the query parameters and updates the window history.
 */
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

/**
 * This function converts a blob to a data URL.
 * @param {Blob} blob - The Blob from which to read.
 * @returns {Promise<string>} Data URL representation of the blob.
 */
function convertBlobToDataUrl(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}
