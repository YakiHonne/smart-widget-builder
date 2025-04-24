import { NDKEvent } from "@nostr-dev-kit/ndk";
import { nanoid } from "nanoid";
import { nip19 } from "nostr-tools";
import { Button, Icon, Image, Input } from "./lib.js";
import WebSocket from "ws";
global.WebSocket = WebSocket;

export const getSubData = async (ndkInstance, filter, timeout = 1000) => {
  if (!filter || filter.length === 0) return { data: [], pubkeys: [] };

  return new Promise((resolve, reject) => {
    let events = [];
    let pubkeys = [];

    let filter_ = filter.map((_) => {
      let temp = { ..._ };
      if (!_["#t"]) {
        delete temp["#t"];
        return temp;
      }
      return temp;
    });

    let sub = ndkInstance.subscribe(filter_, {
      cacheUsage: "CACHE_FIRST",
      groupable: false,
      skipVerification: true,
      skipValidation: true,
    });
    let timer;
    const startTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        sub.stop();
        resolve({
          data: events,
          pubkeys: [...new Set(pubkeys)],
        });
      }, timeout);
    };

    sub.on("event", (event) => {
      pubkeys.push(event.pubkey);
      events.push(event.rawEvent());
      startTimer();
    });

    startTimer();
  });
};

export const validateRelaySet = (relaySet) => {
  if (!Array.isArray(relaySet) || relaySet.length === 0) return false;
  const isValidWssUrl = (url) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "wss:";
    } catch (e) {
      return false;
    }
  };
  return relaySet.every(
    (item) => typeof item === "string" && isValidWssUrl(item)
  );
};

export const bytesTohex = (arrayBuffer) => {
  const byteToHex = [];

  for (let n = 0; n <= 0xff; ++n) {
    const hexOctet = n.toString(16).padStart(2, "0");
    byteToHex.push(hexOctet);
  }
  const buff = new Uint8Array(arrayBuffer);
  const hexOctets = [];

  for (let i = 0; i < buff.length; ++i) hexOctets.push(byteToHex[buff[i]]);

  return hexOctets.join("");
};

export const getNostrEvent = async (
  ndkInstance,
  content,
  tags,
  identifier_,
  type
) => {
  let identifier =
    identifier_ && typeof identifier_ === "string" ? identifier_ : nanoid();
  let tags_ = [["d", identifier], ["l", type], ...tags];
  const ndkEvent = new NDKEvent(ndkInstance);
  ndkEvent.kind = 30033;
  ndkEvent.content = content;
  ndkEvent.tags = tags_;
  await ndkEvent.sign();
  return {
    event: ndkEvent.rawEvent(),
    naddr: nip19.naddrEncode({
      kind: ndkEvent.kind,
      pubkey: ndkEvent.pubkey,
      identifier,
    }),
  };
};

export const isTitleValid = (title) => {
  if (typeof title !== "string") return false;
  return true;
};

export const isURLValid = (url, type) => {
  let emailAddrRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (
    (!type || ["redirect", "post", "app"].includes(type)) &&
    !(
      url.startsWith("https://") ||
      url.startsWith("http://") ||
      url.startsWith("data:image/")
    )
  )
    return {
      status: false,
      msg: "Invalid URL",
    };
  if (
    type === "nostr" &&
    !(
      url.startsWith("nostr:") ||
      url.startsWith("npub") ||
      url.startsWith("nprofile") ||
      url.startsWith("note1") ||
      url.startsWith("nevent") ||
      url.startsWith("naddr")
    )
  )
    return {
      status: false,
      msg: "Invalid nostr URL schema",
    };
  if (
    type === "zap" &&
    !(
      emailAddrRegex.test(url) ||
      (url.startsWith("lnurl") && url.length > 32) ||
      (url.startsWith("lnbc") && url.length > 32)
    )
  )
    return {
      status: false,
      msg: "Invalid zap URL, it must be a valid email address, lnurl* address or an lnbc* invoice",
    };

  return {
    status: true,
  };
};

export const isSWComponentsSetValid = (instance, type) => {
  if (!Array.isArray(instance) || instance.length === 0)
    return {
      status: false,
      msg: "The components array must be a non empty array",
    };

  let isDefault = !["action", "tool"].includes(type);
  let icons = [];
  let images = [];
  let inputs = [];
  let buttons = [];
  let buttonTypes = [];

  for (let comp of instance) {
    if (comp instanceof Icon) icons.push(comp);
    if (comp instanceof Image) images.push(comp);
    if (comp instanceof Input) inputs.push(comp);
    if (comp instanceof Button) {
      buttons.push(comp.getProps().index)
      buttonTypes.push(comp.getProps().type)
    };
    if (
      !(
        comp instanceof Icon ||
        comp instanceof Image ||
        comp instanceof Button ||
        comp instanceof Input
      )
    )
      return {
        status: false,
        msg: "One or more elements are not a smart widget components",
      };
  }

  if (images.length === 0) {
    return {
      status: false,
      msg: "An image component is required",
    };
  }
  if (images.length > 1) {
    return {
      status: false,
      msg: "The number of image components has exceeded the allowed limit (1 max)",
    };
  }

  if (icons.length === 0 && !isDefault) {
    return {
      status: false,
      msg: "An icon component is required for smart widgets with (action | tools) types",
    };
  }
  if (icons.length > 1) {
    return {
      status: false,
      msg: "The number of icon components has exceeded the allowed limit (1 max)",
    };
  }

  if (!isDefault && inputs.length > 0 && buttons.length > 1 && !buttonTypes.includes("app")) {
    return {
      status: false,
      msg: "Only an image and a button of app type are required for smart widgets with (action | tools) types",
    };
  }

  if (inputs.length > 1) {
    return {
      status: false,
      msg: "The number of input components has exceeded the allowed limit (1 max)",
    };
  }
  if (buttons.length > 0 && !isConsecutiveArray(buttons)) {
    return {
      status: false,
      msg: "The number of button components has either exceeded the allowed limit (6 max), or has a non consecutive indexes",
    };
  }

  return {
    status: true,
  };
};

const isConsecutiveArray = (arr) => {
  const sorted = [...new Set(arr)].sort((a, b) => a - b);
  if (sorted.length > 6) return false;
  return (
    sorted.length === arr.length &&
    sorted[0] === 1 &&
    sorted.every((num, i) => num === i + 1)
  );
};
