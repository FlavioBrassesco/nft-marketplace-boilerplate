const axios = require("axios");

function AuthorizedMarketplacesService() {
  const uri = "/api/db/authorizedmarketplaces";

  this.get = async (id) => {
    const data = id ? await axios.get(`${uri}/${id}`) : await axios.get(uri);
    return data;
  };

  this.add = (key, address) => {
    return axios
      .post(uri, {
        key,
        address,
      })
      .then((data) => data);
  };

  this.delete = (id) => {
    return axios.delete(`${uri}/${id}`).then((data) => data);
  };

  this.udpate = (id, key, address) => {
    return axios
      .put(`${uri}/${id}`, {
        key,
        address,
      })
      .then((data) => data);
  };
}

module.exports = AuthorizedMarketplacesService;
