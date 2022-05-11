import { useState } from "react";
import CollectionSelect from "../components/CollectionSelect";
import StatusSelect from "../components/StatusSelect";
import StatusPrice from "../components/StatusPrice";
import StatusDays from "../components/StatusDays";
import { ethers } from "ethers";
import ItemCard from "../components/ItemCard";

import { Grid, Paper, Stack, Container, Divider } from "@mui/material";

const data = [
  {
    name: "#1109",
    collection: "Stories from the crypto",
    price: (Math.random() * 10).toFixed(2),
    priceUSD: (Math.random() * 50).toFixed(2),
    image: `https://picsum.photos/seed/cripto/200/200`,
    status: "Auction"
  },
  {
    name: "#1122",
    collection: "Trashure",
    price: (Math.random() * 10).toFixed(2),
    priceUSD: (Math.random() * 50).toFixed(2),
    image: `https://picsum.photos/seed/stories/200/200`,
    status: "For Sale"
  },
  {
    name: "#1144",
    collection: "CoffeeDogs",
    price: (Math.random() * 10).toFixed(2),
    priceUSD: (Math.random() * 50).toFixed(2),
    image: `https://picsum.photos/seed/dog/200/200`,
    status: "For Sale"
  },
]

const Home = () => {
  const [collection, setCollection] = useState([]);
  const [status, setStatus] = useState("All");
  const [days, setDays] = useState(7);
  const [values, setValues] = useState([0, 1000]);

  const range = [
    ethers.utils.parseEther("0.000001"),
    ethers.utils.parseEther("0.010"),
  ];

  const handleChange = (event) => {
    const {
      target: { value },
    } = event;
    setCollection(
      // On autofill we get a stringified value.
      typeof value === "string" ? value.split(",") : value
    );
  };

  return (
    <Container maxWidth="lg">
      <Grid container spacing={2} component="main" sx={{ py: 4 }}>
        <Grid item md={4}>
          <Paper sx={{ p: 2 }} elevation={6}>
            <Stack spacing={2}>
              <CollectionSelect
                label="Collections:"
                value={collection}
                options={["Stories From The Crypto", "CoffeeDogs", "Trashure"]}
                change={handleChange}
              />
              <Divider />
              <StatusSelect
                value={status}
                change={(e) => setStatus(e.target.value)}
              />
              <StatusPrice
                label={status === "Auction" ? "Highest Bid" : "Price"}
                values={values}
                range={range}
                change={(e, values) => setValues(values)}
              />
              {status === "Auction" && (
                <StatusDays
                  value={days}
                  change={(e, value) => setDays(value)}
                />
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid container item md={8} spacing={2}>
          {data.map((nft) => (
            <Grid md={4} key={nft.name} item>
              <ItemCard nft={nft}/>
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Container>
  );
};

export default Home;
