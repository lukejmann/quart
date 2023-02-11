/* eslint-disable @typescript-eslint/no-var-requires */
const { VanillaExtractPlugin } = require('@vanilla-extract/webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { getLoader, loaderByName } = require('@craco/craco')

const path = require(`path`)

const packages = []
packages.push(path.resolve(__dirname, `../sync-core`))

module.exports = {
    babel: {
        plugins: ['@vanilla-extract/babel-plugin'],
    },
    webpack: {
        plugins: [
            new VanillaExtractPlugin({
                externals: packages,
            }),
        ],
        configure: (webpackConfig) => {
            const instanceOfMiniCssExtractPlugin = webpackConfig.plugins.find(
                (plugin) => plugin instanceof MiniCssExtractPlugin
            )
            if (instanceOfMiniCssExtractPlugin !== undefined) instanceOfMiniCssExtractPlugin.options.ignoreOrder = true

            const { isFound, match } = getLoader(webpackConfig, loaderByName('babel-loader'))
            if (isFound) {
                const include = Array.isArray(match.loader.include) ? match.loader.include : [match.loader.include]

                match.loader.include = include.concat(packages)
            }

            return webpackConfig
        },
    },
}