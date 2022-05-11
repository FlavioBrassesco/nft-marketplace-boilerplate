module.exports = {
  reactStrictMode: true,
  env: {
    mongodburl:
      "mongodb+srv://flaviobrasso:M0n60db%21789@notes.tskkj.mongodb.net/marketplace?retryWrites=true&w=majority",
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },
  images: {
    domains: ["picsum.photos"]
  }
};
