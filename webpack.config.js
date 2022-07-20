const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")
const path = require('path');
const webpack = require('webpack');

module.exports = {
    mode: "production",
    entry: {
        index: path.resolve(__dirname, './js/index.js')
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname),
    },
    target: ['web', 'es5'],
    plugins: [
        new NodePolyfillPlugin(),
        new webpack.DefinePlugin({
            CLIENT_ID: JSON.stringify("https://solid-md-viewer.netlify.app/id")
        })
    ],
    watchOptions: {
        ignored: ['**/node_modules', '**/.idea'],
    }
};
