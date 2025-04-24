import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKRelaySet,
} from "@nostr-dev-kit/ndk";
import { generateSecretKey } from "nostr-tools";
import * as sec from "@noble/secp256k1";
import { DEFAULT_RELAYS } from "../Assets/DEFAULT_RELAYS.js";
import dotenv from "dotenv";
import {
  bytesTohex,
  getNostrEvent,
  getSubData,
  isSWComponentsSetValid,
  isTitleValid,
  isURLValid,
  validateRelaySet,
} from "./helpers.js";

import WebSocket from "ws";
dotenv.config();

const sk = bytesTohex(generateSecretKey());
global.WebSocket = WebSocket;

/**
 * Smart Widget instance
 * @class
 */
export class SW {
  /**
   * @param {string} type the smart widget type (basic | action | tool)
   * @param {array} relaySet An array of valid wss:// URLs
   * @param {string} secretKey (optional) a hex string secret key for publishing purposes, if not provided the instance will check for any environment variable under process.env.SECRET_KEY , or else it will take a random value
   */

  constructor(type = "basic", relaySet, secretKey) {
    if (!["basic", "action", "tool"].includes(type))
      throw Error(
        "The smart widget type should be one of these values (basic | action | tool)"
      );
    if (relaySet && !validateRelaySet(relaySet)) {
      throw Error(
        "Relay set is invalid or empty. Please provide a valid array of wss:// URLs"
      );
    }
    if (secretKey && !sec.utils.isValidPrivateKey(secretKey)) {
      throw Error("Invalid secretKey");
    }
    this.type = type;
    this.relaySet = relaySet || DEFAULT_RELAYS;
    this.secretKey = secretKey || process.env.SECRET_KEY || sk;
    this.ndkInstance = new NDK({
      explicitRelayUrls: this.relaySet,
    });
    this.ndkInstance.signer = new NDKPrivateKeySigner(this.secretKey);
  }

  /**
   * Get instance props
   */
  getProps() {
    return {
      type: this.type,
      relaySet: this.relaySet,
      secretKey: this.secretKey,
    };
  }

  /**
   * Initiate relays connection
   */
  async init() {
    await this.ndkInstance.connect();
  }

  /**
   * Publish a smart widget, the init() method is required before using this method
   * @param {SWComponentsSet} components smart widget components
   * @param {string} title (optional) smart widget title
   * @param {string} identifier (optional) a unique string to mark the event, if not provided a random string will be generated
   * @param {number} [timeout=3000] (optional) the timeout for the publish operation in milliseconds.
   * @returns {Promise} a Promise that resolves to an object containing the actual event and the naddr encoding
   */
  async publish(components, title, identifier = "", timeout = 3000) {
    if (!isTitleValid(title))
      throw Error("The title should be an empty or valid string");
    if (!(components instanceof SWComponentsSet))
      throw Error("The components should be a SWComponentsSet instance");

    let content = title || "";
    const event = await getNostrEvent(
      this.ndkInstance,
      content,
      components.getProps(),
      identifier,
      this.type
    );

    return new Promise((resolve, reject) => {
      try {
        const toPublish = new NDKEvent(this.ndkInstance, event.event);

        const ndkRelays = this.ndkInstance.explicitRelayUrls.map((_) => {
          return new NDKRelay(_, undefined, this.ndkInstance);
        });
        const ndkRelaysSet = new NDKRelaySet(ndkRelays, this.ndkInstance);
        toPublish.publish(ndkRelaysSet);

        let timer = setTimeout(() => {
          reject(
            "Event could not be published, make sure to init() your smart widget instance or change your relays set"
          );
          clearTimeout(timer);
        }, [timeout]);

        let subscription = this.ndkInstance.subscribe([
          { ids: [event.event.id] },
        ]);
        subscription.on("event", (_) => {
          clearTimeout(timer);
          subscription.stop();
          resolve(event);
        });
      } catch (err) {
        reject(
          "Event could not be published, make sure to init() your smart widget instance or change your relays set"
        );
      }
    });
  }

  /**
   * Sign and get smart widget nostr event, the init() method is not required to use this method
   * @param {SWComponentsSet} components smart widget components
   * @param {string} title (optional) smart widget title
   * @returns {Promise} a Promise that resolves to an object containing the actual event and the naddr encoding
   */
  async signEvent(components, title, identifier = "") {
    if (!isTitleValid(title))
      throw Error("The title should be an empty or valid string");
    if (!(components instanceof SWComponentsSet))
      throw Error("The components should be a SWComponentsSet instance");

    let content = title || "";
    const event = await getNostrEvent(
      this.ndkInstance,
      content,
      components.getProps(),
      identifier,
      this.type
    );
    return event;
  }

  /**
   * Search nostr for event
   * @param {array} filter an array of filter following nostr specifications
   * @returns {Promise} a Promise that resolves to an object containing the events and all pubkeys associated with them
   */
  async searchNostr(filter) {
    if (!Array.isArray(filter)) {
      throw Error("The filter param must be an array of objects");
    }

    const data = await getSubData(this.ndkInstance, filter);
    return data;
  }
}

/**
 * Smart widget Image component
 * A recommended 1:1 image for (action | tool) types of widgets
 * @class
 */
export class Icon {
  /**
   * @param {string} url icon url
   */
  constructor(url) {
    let checkURL = isURLValid(url);
    if (!checkURL.status) {
      throw Error(checkURL.msg);
    }
    this.url = url;
  }

  /**
   * Get icon url
   * @returns an object with the icon url
   */
  getProps() {
    return {
      url: this.url,
    };
  }
}

/**
 * Smart widget Image component
 * @class
 */
export class Image {
  /**
   * @param {string} url image url
   */
  constructor(url) {
    let checkURL = isURLValid(url);
    if (!checkURL.status) {
      throw Error(checkURL.msg);
    }
    this.url = url;
  }

  /**
   * Get image url
   * @returns an object with the image url
   */
  getProps() {
    return {
      url: this.url,
    };
  }
}

/**
 * Smart widget Input component
 * @class
 */
export class Input {
  /**
   * @param {string} label input label or placeholder
   */
  constructor(label) {
    if (!label || typeof label !== "string") {
      throw Error("Image url is required");
    }
    this.label = label;
  }

  /**
   * Get input label
   * @returns an object wiht the input label
   */
  getProps() {
    return {
      label: this.label,
    };
  }
}

/**
 * Smart widget Button component
 * @class
 */
export class Button {
  /**
   *
   * @param {number} index the index in which the button will be placed in order on the smart widget (left to right)
   * @param {string} label the button label or tex
   * @param {string} type the button type (redirect | nostr | zap | post | app)
   * @param {string} url the button url
   */
  constructor(index, label, type, url) {
    if (typeof index !== "number" || index === 0) {
      throw Error("Button index must be an integer greater than 0");
    }
    if (!label || typeof label !== "string") {
      throw Error("Button label is required");
    }
    if (!["nostr", "zap", "redirect", "post", "app"].includes(type)) {
      throw Error(
        "Button type must be one these values (redirect | nostr | zap | post | app)"
      );
    }
    if (!url || typeof url !== "string") {
      throw Error("Button url is required");
    }
    let checkURL = isURLValid(url, type);
    if (!checkURL.status) {
      throw Error(checkURL.msg);
    }
    this.index = index;
    this.label = label;
    this.type = type;
    this.url = url;
  }

  /**
   * Get button properties
   * @returns an object with the button properties (index, lable, type, url)
   */
  getProps() {
    return {
      index: this.index,
      label: this.label,
      type: this.type,
      url: this.url,
    };
  }
}

/**
 * Smart widget component set
 * @class
 */
export class SWComponentsSet {
  /**
   *
   * @param {array} components an array of smart widget components
   * @param {SW} smartWidgetInstance the smart widget instance
   */
  constructor(components, smartWidgetInstance) {
    let type = "basic";
    if (smartWidgetInstance instanceof SW)
      type = smartWidgetInstance.getProps().type;
    let checkComps = isSWComponentsSetValid(components, type);
    if (!checkComps.status) throw Error(checkComps.msg);
    this.components = components;
  }

  /**
   * Get smart widget component
   * @returns an array of array representing the smart widget components to use in a nostr event
   */
  getProps() {
    let icons = [];
    let images = [];
    let inputs = [];
    let buttons = [];
    for (let comp of this.components) {
      if (comp instanceof Icon) images.push(["icon", comp.getProps().url]);
      if (comp instanceof Image) images.push(["image", comp.getProps().url]);
      if (comp instanceof Input) inputs.push(["input", comp.getProps().label]);
      if (comp instanceof Button)
        buttons.push({
          index: comp.getProps().index,
          metadata: [
            "button",
            comp.getProps().label,
            comp.getProps().type,
            comp.getProps().url,
          ],
        });
    }
    return [
      ...icons,
      ...images,
      ...inputs,
      ...buttons.sort((a, b) => a.index - b.index).map((_) => _.metadata),
    ];
  }
}
