# Markdown viewer

View Markdown files that are hosted on a Solid pod.
You find a live demo of the app [here](https://solid-md-viewer.netlify.app/).

## Usage
1. Install dependencies via
   ```shell
    npm i
   ```
2. Build via
   ```shell
   npm run prestart
   ```
3. Start server and watch for changes during development via
   ```shell
   npm run watch
   ```

## Query parameters

- `root`: This parameter contains the root of the markdown files. It is used for the home link at the top.
- `current`: This parameter contains the current markdown file that is displayed.

## License

This code is copyrighted by [Ghent University – imec](http://idlab.ugent.be/) and released under the [MIT license](http://opensource.org/licenses/MIT).