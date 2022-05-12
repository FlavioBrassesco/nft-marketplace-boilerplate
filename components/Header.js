import { useEffect, useState } from "react";
import {
  AppBar,
  Avatar,
  Toolbar,
  Tooltip,
  IconButton,
  Box,
  Badge,
  Container,
  Menu,
  MenuItem,
  Button,
  Typography,
  Tabs,
  Tab,
  Divider,
  SvgIcon,
} from "@mui/material";
import { NextLinkComposed } from "../src/Link";
import useProvider from "../helpers/useProvider";
import connectMetamask from "../services/blockchain/connectMetamask";
import md5 from "crypto-js/md5";

import Logo from "./vercel.svg";
import MetamaskLogo from "./metamask.svg";
import styles from "./Header.module.css";

import { FiDollarSign } from "react-icons/fi";

const Header = () => {
  const { provider, setProvider, signer } = useProvider();
  const [signerAddress, setSignerAddress] = useState("");
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [tab, setTab] = useState(0);

  const handleOpenUserMenu = (e) => {
    setAnchorElUser(e.currentTarget);
  };
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleConnectMetamask = (e) => {
    if (!window.ethereum) {
      window.open("https://metamask.io/", "_blank").focus();
      return;
    }
    connectMetamask()
      .then((provider) => {
        setProvider(provider);
      })
      .catch((error) => error);
  };

  const handleTab = (e, v) => {
    setTab(v);
  };

  useEffect(() => {
    if (signer)
      signer
        .getAddress()
        .then((address) => {
          setSignerAddress(address);
        })
        .catch((error) => error);
  }, [signer]);

  return (
    <AppBar position="static">
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: "space-between" }}>
          <Box>
            <Logo className={styles.logo} />
            <Typography
              variant="h6"
              noWrap
              component="a"
              href="/"
              sx={{
                color: "inherit",
                ml: 2,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              NFT Marketplace
            </Typography>
          </Box>

          <Box>
            <Tabs value={tab} onChange={handleTab} textColor="inherit">
              <Tab
                label="Overview"
                component={NextLinkComposed}
                to={{ pathname: "/" }}
                id="view-tab-0"
              />
              <Tab
                label="Collections"
                component={NextLinkComposed}
                to={{ pathname: "/collections" }}
                id="view-tab-1"
              />
              <Tab
                label="Activity"
                component={NextLinkComposed}
                to={{ pathname: "/activity" }}
                id="view-tab-2"
              />
            </Tabs>
          </Box>

          <Box>
            {provider === null ? (
              <Button onClick={handleConnectMetamask} sx={{ color: "inherit" }}>
                <MetamaskLogo className={styles["metamask-logo"]} />
                <Typography noWrap sx={{ ml: 1 }}>
                  Connect Metamask
                </Typography>
              </Button>
            ) : (
              <>
                <Tooltip title="User account">
                  <IconButton onClick={handleOpenUserMenu}>
                    <Badge color="secondary" badgeContent={<FiDollarSign />}>
                      <Avatar
                        alt={signerAddress}
                        src={`https://www.gravatar.com/avatar/${md5(
                          signerAddress
                        )}?d=retro&f=y&s=128`}
                      />
                    </Badge>
                  </IconButton>
                </Tooltip>
                <Menu
                  id="user-account"
                  anchorEl={anchorElUser}
                  keepMounted
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                >
                  <MenuItem
                    onClick={handleCloseUserMenu}
                    component={NextLinkComposed}
                    to={{ pathname: "/user/items" }}
                  >
                    <Typography textAlign="center">My Nfts</Typography>
                  </MenuItem>
                  <MenuItem
                    onClick={handleCloseUserMenu}
                    component={NextLinkComposed}
                    to={{ pathname: "/user/offers" }}
                  >
                    <Typography textAlign="center">My Offers</Typography>
                  </MenuItem>
                  <Divider />

                  <MenuItem
                    onClick={handleCloseUserMenu}
                    component={NextLinkComposed}
                    to={{ pathname: "/user/funds" }}
                  >
                    <Typography textAlign="center">Withdraw Funds</Typography>
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header;
