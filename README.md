# Smart Widget (SW) - Nostr Integration Library

A JavaScript library for creating and managing Smart Widgets on the Nostr protocol.

## Installation

```bash
npm install smart-widget-builder
```
## Features

- Create and publish Smart Widgets to Nostr relays
- Flexible relay configuration
- Event signing and publishing
- Nostr event searching capabilities

## Quick start
```js
const { SW, Image, Input, Button, SWComponentsSet } = require('smart-widget-builder');

// Initialize Smart Widget
const sw = new SW("basic", ['wss://relay.example.com']);

// Create components
const components = new SWComponentsSet([
  new Image('https://example.com/image.jpg'),
  new Input('Enter text here'),
  new Button(1, 'Click Me', 'redirect', 'https://example.com')
]);

// Connect and publish
async function publishWidget() {
  await sw.init();
  const result = await sw.publish(components, 'My Widget');
  console.log(result);
}
```
## Classes
### SW
Main Smart Widget class for managing Nostr connections and publications

- Smart widget types: `basic`, `action`, `tool`
  - `basic` a smart widget with multiple components
  - `action` a smart widget with an image and a button of type app, this should open the url in a form of an iframe (the iframe should return nothing)
  - `tool` a smart widget with an image and a button of type app, this should open the url in a form of an iframe (the iframe should return data)
- `constructor(type, relaySet, secretKey)` - A type pf `basic` is the default and a preset relays list and a randomly generated secret key will be used if the construction params are left empty
- `init()` - Connect to relays
- `publish(components, title, identifier, timeout)` - Publish a widget
- `signEvent(components, title, identifier)` - Sign a widget event
- `searchNostr(filter)` - Search Nostr events

### Components
- `Icon(url)` - Icon component, it is recommended with widgets of `action` and `tool` types
- `Image(url)` - Image component
- `Input(label)` - Input field component
- `Button(index, label, type, url)` - Button component
  - Button types: `redirect`, `nostr`, `zap`, `post`, `app`
  - `redirect` a URL redirect
  - `nostr` a nostr schema URL (ie: nostr:npub.. , nevent1..) 
  - `zap` a lightning address or a lightning invoice to proceeding for zapping
  - `post` a `POST` request to an endpoint that returns a smart widget event
  - `app` an internally opened URL
- `SWComponentsSet(components, SW_INSTANCE)` - Component collection

## Configuration (optional if used in NodeJS)
Create a .env file for the secret key, this will be used as a fallback if the SW() constructor was not provided with one to sign and publish event
```
SECRET_KEY=your-hex-secret-key
```