import path from "path";
import { fileURLToPath } from "url";
import PugPlugin from "pug-plugin";
import dotenv from "dotenv";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config();

const prod = process.env.NODE_ENV === "production";

const config = {
  entry: {
    index: "./public/index.pug",
    404: "./public/404.pug",
    watch: "./public/watch.pug",
    "player-wrapper": "./public/player-wrapper.pug",
  },
  output: {
    path: path.join(__dirname, "dist"),
    publicPath: "/",
    filename: "assets/js/[name].[contenthash:8].js",
  },
  module: {
    rules: [
      {
        test: /\.pug$/,
        loader: PugPlugin.loader,
      },
      {
        test: /\.ts(x)?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(css|sass|scss)$/,
        use: [
          {
            loader: "css-loader",
            options: {
              import: false,
            },
          },
          "sass-loader",
        ],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  plugins: [
    new PugPlugin({
      pretty: !prod,
      css: {
        filename: "assets/css/[name].[contenthash:8].css",
      },
    }),
  ],
  mode: prod ? "production" : "development",
  devServer: {
    port: 3000,
    static: {
      directory: path.join(__dirname, "dist"),
    },

    watchFiles: {
      paths: ["public/**/*.*"],
      options: {
        usePolling: true,
      },
    },

    proxy: [
      {
        path: ["/api", "/ssr", "/playlist"],
        target: `http://localhost:${process.env.PORT}/`,
        secure: false,
      },
      {
        path: "/watch",
        target: `ws://localhost:${process.env.PORT}`,
        ws: true,
      },
    ],
  },
};

export default config;
