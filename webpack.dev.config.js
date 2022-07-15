const config = require('./webpack.config');
const webpack = require('webpack');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = Object.assign(config, {
    mode: "development",
    devtool: 'source-map',
    devServer: {
        headers: (data) => {
            if (data.baseUrl === '/id') {
                return {'Content-Type': 'application/ld+json'}
            }

            return {};
        }
    },
    plugins: [
        new NodePolyfillPlugin(),
        new webpack.DefinePlugin({
            CLIENT_ID: JSON.stringify("http://localhost:8080/id")
        })
    ]
})
