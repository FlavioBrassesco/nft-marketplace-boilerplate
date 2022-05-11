import ItemBanner from "../components/ItemBanner";
import ItemProperties from "../components/ItemProperties";
import ItemDetails from "../components/ItemDetails";
import ItemHistory from "../components/ItemHistory";
import ItemManage from "../components/ItemManage";
import ItemCard from "../components/ItemCard";
import { Container, Grid, Typography } from "@mui/material";

const properties = [
  { name: "Body", value: "Red", percentage: "10%" },
  { name: "Face", value: "Dumb", percentage: "30%" },
  { name: "Hat", value: "Donkey", percentage: "10%" },
  { name: "Accesory", value: "Sun Glasses", percentage: "1%" },
];

const details = {
  address: "0x8920...2020",
  ipfsJson: "https://ipfs.io/1020391240",
};

const history = [
  {
    event: "Sold",
    price: "0,2",
    from: "0x90....2021",
    to: "0x90....2022",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Listed",
    price: "0,2",
    from: "0x90....2021",
    to: "",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Minted",
    price: "",
    from: "0x90....2020",
    to: "0x90....2021",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Sold",
    price: "0,2",
    from: "0x90....2021",
    to: "0x90....2022",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Listed",
    price: "0,2",
    from: "0x90....2021",
    to: "",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Minted",
    price: "",
    from: "0x90....2020",
    to: "0x90....2021",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Sold",
    price: "0,2",
    from: "0x90....2021",
    to: "0x90....2022",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Listed",
    price: "0,2",
    from: "0x90....2021",
    to: "",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Minted",
    price: "",
    from: "0x90....2020",
    to: "0x90....2021",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Sold",
    price: "0,2",
    from: "0x90....2021",
    to: "0x90....2022",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Listed",
    price: "0,2",
    from: "0x90....2021",
    to: "",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Minted",
    price: "",
    from: "0x90....2020",
    to: "0x90....2021",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Sold",
    price: "0,2",
    from: "0x90....2021",
    to: "0x90....2022",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Listed",
    price: "0,2",
    from: "0x90....2021",
    to: "",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Minted",
    price: "",
    from: "0x90....2020",
    to: "0x90....2021",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Sold",
    price: "0,2",
    from: "0x90....2021",
    to: "0x90....2022",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Listed",
    price: "0,2",
    from: "0x90....2021",
    to: "",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
  {
    event: "Minted",
    price: "",
    from: "0x90....2020",
    to: "0x90....2021",
    date: new Date(Date.now()).toDateString(),
    url: "https://iwiwiwiw.io/20020202",
  },
];

const data = [
  {
    name: "#1109",
    collection: "Stories from the crypto",
    price: (Math.random() * 10).toFixed(2),
    priceUSD: (Math.random() * 50).toFixed(2),
    image: `https://picsum.photos/seed/cripto/200/200`,
    status: "Auction",
  },
  {
    name: "#1122",
    collection: "Trashure",
    price: (Math.random() * 10).toFixed(2),
    priceUSD: (Math.random() * 50).toFixed(2),
    image: `https://picsum.photos/seed/stories/200/200`,
    status: "For Sale",
  },
  {
    name: "#1144",
    collection: "CoffeeDogs",
    price: (Math.random() * 10).toFixed(2),
    priceUSD: (Math.random() * 50).toFixed(2),
    image: `https://picsum.photos/seed/dog/200/200`,
    status: "For Sale",
  },
  {
    name: "#1112",
    collection: "Stories from the crypto",
    price: (Math.random() * 10).toFixed(2),
    priceUSD: (Math.random() * 50).toFixed(2),
    image: `https://picsum.photos/seed/criptos/200/200`,
    status: "Auction",
  },
];

const Item = () => {
  return (
    <Container maxWidth="lg">
      <Grid container spacing={2} component="main" sx={{ py: 4 }}>
        <Grid item xs={12}>
          <ItemBanner />
        </Grid>
        <Grid item xs={12} container spacing={2}>
          <Grid item sm={4}>
            <ItemManage />
            <ItemProperties properties={properties} />
            <ItemDetails details={details} />
          </Grid>
          <Grid item sm={8}>
            <ItemHistory history={history} />
          </Grid>
        </Grid>
        <Grid item xs={12} mt={4} mb={1}>
          <Typography variant="h5" component="h3">
            More from this collection
          </Typography>
        </Grid>
        <Grid container item xs={12} spacing={2}>
          {data.map((nft) => (
            <Grid md={3} key={nft.name} item>
              <ItemCard nft={nft} />
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Container>
  );
};

export default Item;
