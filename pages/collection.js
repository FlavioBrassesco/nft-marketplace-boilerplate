import {
  Box,
  Container,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tabs,
  Tab,
  TableContainer,
  TableRow,
  TableCell,
  Table,
  TableHead,
  TableBody,
  TableFooter,
  TablePagination,
  Paper,
  AccordionDetails,
  AccordionSummary,
  Accordion,
  SvgIcon,
  IconButton,
  Avatar,
} from "@mui/material";
import CollectionBanner from "../components/CollectionBanner";
import ItemCard from "../components/ItemCard";
import {
  FiChevronDown,
  FiExternalLink,
  FiChevronLeft,
  FiChevronsLeft,
  FiChevronRight,
  FiChevronsRight,
} from "react-icons/fi";
import { FaEthereum } from "react-icons/fa";

import { useState, useEffect } from "react";

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
];

const traits = [
  {
    name: "Background",
    types: [
      { name: "Red", qty: 100, rarity: "10%" },
      { name: "Blue", qty: 150, rarity: "15%" },
      { name: "Yellow", qty: 10, rarity: "1%" },
      { name: "Green", qty: 110, rarity: "11%" },
    ],
  },
  {
    name: "Face",
    types: [
      { name: "Dumb", qty: 100, rarity: "10%" },
      { name: "Laughing", qty: 150, rarity: "15%" },
      { name: "Angry", qty: 10, rarity: "1%" },
      { name: "Sleepy", qty: 110, rarity: "11%" },
    ],
  },
  {
    name: "Body",
    types: [
      { name: "Heman", qty: 100, rarity: "10%" },
      { name: "Conan", qty: 150, rarity: "15%" },
      { name: "Goku", qty: 10, rarity: "1%" },
      { name: "Piccolo", qty: 110, rarity: "11%" },
    ],
  },
];

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

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`view-tabpanel-${index}`}
      {...other}
    >
      {value === index && <>{children}</>}
    </Box>
  );
}

function TablePaginationActions(props) {
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (event) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (event) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        <SvgIcon>
          <FiChevronsLeft />
        </SvgIcon>
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        <SvgIcon>
          <FiChevronLeft />
        </SvgIcon>
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        <SvgIcon>
          <FiChevronRight />
        </SvgIcon>
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        <SvgIcon>
          <FiChevronsRight />
        </SvgIcon>
      </IconButton>
    </Box>
  );
}

const Collection = () => {
  const [tab, setTab] = useState(0);
  const [tAcc, setTAcc] = useState([]);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - history.length) : 0;

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getHandleTAcc = (i) => () => {
    const nAcc = [...tAcc];
    nAcc[i] = !nAcc[i];
    setTAcc(nAcc);
  };

  const handleTab = (e, v) => {
    setTab(v);
  };

  useEffect(() => {
    setTAcc([...Array(traits.length)].fill(true));
  }, []);

  return (
    <Container maxWidth="lg">
      <Stack alignItems="center" spacing={2} py={4}>
        <CollectionBanner />

        <Tabs value={tab} onChange={handleTab}>
          <Tab label="Items" id="view-tab-0" />
          <Tab label="Traits" id="view-tab-1" />
          <Tab label="Activity" id="view-tab-2" />
        </Tabs>
      </Stack>

      <TabPanel mb={4} value={tab} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "end",
              }}
            >
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Filter By
                </Typography>

                <Stack spacing={1} direction="row" alignItems="center">
                  <ToggleButtonGroup exclusive value="For Sale">
                    <ToggleButton value="All">All</ToggleButton>
                    <ToggleButton value="For Sale">For Sale</ToggleButton>
                  </ToggleButtonGroup>

                  <Chip
                    label="Trait1"
                    variant="outlined"
                    onClick={(f) => f}
                    onDelete={(f) => f}
                  />
                  <Chip
                    label="Trait2"
                    variant="outlined"
                    onClick={(f) => f}
                    onDelete={null}
                  />
                  <Chip
                    label="Trait3"
                    variant="outlined"
                    onClick={(f) => f}
                    onDelete={null}
                  />
                </Stack>
              </Stack>

              <FormControl>
                <InputLabel id="collection-select">Sort By</InputLabel>
                <Select
                  labelId="collection-select"
                  id="collection-select-value"
                  value="Lowest Price"
                  label="Sort By"
                  onChange={(f) => f}
                >
                  {["Lowest Price", "Highest Price", "Token ID"].map((o, i) => (
                    <MenuItem key={i} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2">161 results</Typography>
          </Grid>
          <Grid item container xs={12} spacing={2}>
            {data.map((d) => (
              <Grid item md={3} key={d.name}>
                <ItemCard nft={d} />
              </Grid>
            ))}
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={1} mb={4}>
        {traits.map((t, i) => (
          <Accordion expanded={tAcc[i]} onClick={getHandleTAcc(i)} key={t.name}>
            <AccordionSummary
              expandIcon={
                <SvgIcon>
                  <FiChevronDown />
                </SvgIcon>
              }
              id="details-accordion"
            >
              <Typography ml={1}>{t.name}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Count</TableCell>
                      <TableCell>Rarity</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {t.types.map((t) => (
                      <TableRow key={t.name}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.qty}</TableCell>
                        <TableCell>{t.rarity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))}
      </TabPanel>

      <TabPanel value={tab} index={2} mb={4}>
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <Typography variant="subtitle2">Filter By</Typography>
          <Chip
            label="Listed"
            variant="outlined"
            onClick={(f) => f}
            onDelete={null}
          />
          <Chip
            label="Delisted"
            variant="outlined"
            onClick={(f) => f}
            onDelete={null}
          />
          <Chip
            label="Sold"
            variant="outlined"
            onClick={(f) => f}
            onDelete={null}
          />
          <Chip
            label="Modified"
            variant="outlined"
            onClick={(f) => f}
            onDelete={null}
          />
        </Stack>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Date</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? history.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : history
              ).map((h, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Stack direction="row" alignItems="center">
                      <Avatar
                        src="https://picsum.photos/seed/cripto/200/200"
                        alt=""
                        sx={{ width: 60, height: 60 }}
                      />
                      <Stack ml={2}>
                        <Typography variant="subtitle2" lineHeight={1.1}>
                          Collection Name
                        </Typography>
                        <Typography
                          variant="h6"
                          component="h3"
                          lineHeight={1.1}
                        >
                          NFT Name #1092
                        </Typography>
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">{h.event}</Typography>
                  </TableCell>
                  <TableCell>
                    {h.price !== "" ? (
                      <Stack direction="row" alignItems="center">
                        <Typography color="primary.main" lineHeight={0}>
                          <SvgIcon fontSize="small">
                            <FaEthereum />
                          </SvgIcon>
                        </Typography>

                        <Typography>{h.price}</Typography>
                      </Stack>
                    ) : (
                      <>&mdash;</>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography
                      href="#"
                      component="a"
                      variant="body2"
                      color="text.secondary"
                      sx={{ textDecoration: "none" }}
                    >
                      {h.from}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      href="#"
                      variant="body2"
                      component="a"
                      color="text.secondary"
                      sx={{ textDecoration: "none" }}
                    >
                      {h.to || <>&mdash;</>}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {h.date}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      href={h.url}
                      component="a"
                      sx={{ textDecoration: "none" }}
                      color="text.secondary"
                    >
                      <SvgIcon>
                        <FiExternalLink />
                      </SvgIcon>
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {emptyRows > 0 && (
                <TableRow style={{ height: 64 * emptyRows }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={6}
                  count={history.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  SelectProps={{
                    inputProps: {
                      "aria-label": "rows per page",
                    },
                    native: true,
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </TabPanel>
    </Container>
  );
};

export default Collection;
