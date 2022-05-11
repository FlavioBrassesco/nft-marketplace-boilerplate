import {
  Grid,
  Container,
  Typography,
  IconButton,
  SvgIcon,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Pagination,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import CollectionCard from "../components/CollectionCard";
import { FiGrid, FiList } from "react-icons/fi";

const data = [
  {
    name: "Stories from the crypto",
    banner: "https://picsum.photos/seed/stories/200/200",
    avatar: "https://picsum.photos/seed/storiesa/200/200",
    volume: "100,000",
  },
  {
    name: "CoffeeDogs",
    banner: "https://picsum.photos/seed/storiesss/200/200",
    avatar: "https://picsum.photos/seed/storiessa/200/200",
    volume: "120,000",
  },
  {
    name: "Trashure",
    banner: "https://picsum.photos/seed/storiesssss/200/200",
    avatar: "https://picsum.photos/seed/storiesssa/200/200",
    volume: "140,000",
  },
];

const Collections = () => {
  return (
    <Container maxWidth="lg">
      <Grid container spacing={2} sx={{ py: 4 }}>
        <Grid item xs={12}>
          <Typography variant="h2">Collections</Typography>
        </Grid>
        <Grid item xs={12}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <ToggleButtonGroup value="grid" exclusive>
              <ToggleButton value="grid">
                <SvgIcon>
                  <FiGrid />
                </SvgIcon>
              </ToggleButton>
              <ToggleButton value="list">
                <SvgIcon>
                  <FiList />
                </SvgIcon>
              </ToggleButton>
            </ToggleButtonGroup>

            <FormControl>
              <InputLabel id="collection-select">Sort by</InputLabel>
              <Select
                labelId="collection-select"
                id="collection-select-value"
                value="Collection"
                label="Sort by"
                onChange={(f) => f}
              >
                {[
                  "Collection",
                  "Volume",
                  "Items",
                  "Supply",
                  "Lowest Price",
                  "Highest Price",
                ].map((o, i) => (
                  <MenuItem key={i} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Grid>
        {data.map((d) => (
          <Grid item md={4} key={d.name}>
            <CollectionCard collection={d} />
          </Grid>
        ))}
        <Grid item xs={12} mt={4}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Pagination count={3} />
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Collections;
