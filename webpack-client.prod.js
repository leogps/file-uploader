const path = require('path');
const common = require('./webpack-client.common');
const webpackMerge = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const cleanWebpackPlugin = require("clean-webpack-plugin");

module.exports = webpackMerge.merge(common,{
    mode: 'production',
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader, // 3. Extract css into files. 
                    {
                        loader: 'css-loader',   // 2. Turns css into commonJS
                    },
                    {
                        loader: 'postcss-loader',
                    }
                ]
            },
            {
                test: /(\.scss|\.sass)$/,
                use: [
                    MiniCssExtractPlugin.loader, // 3. Extract css into files. 
                    {
                        loader: 'css-loader',   // 2. Turns css into commonJS
                    },
                    {
                        loader: 'postcss-loader',
                    },
                    {
                        loader: 'sass-loader', // 1. Turns sass to css
                        options: {
                            sassOptions: {
                                includePaths: [
                                    path.resolve(__dirname, './node_modules'),
                                    path.resolve(__dirname, './src-client')
                                ]
                            }
                        },
                    }
                ]
            }
        ]
    },
    optimization: {
        minimize: true,
        minimizer: [
            // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
            // `...`,
            new CssMinimizerPlugin()
        ],
    },
    plugins: [
        new cleanWebpackPlugin.CleanWebpackPlugin(),
        new MiniCssExtractPlugin({filename: "[name].[contenthash].css"})
    ],
    output: {
        filename: '[name].[contenthash].bundle.js',
        path: path.resolve(__dirname, 'dist/client/'),
    }
});