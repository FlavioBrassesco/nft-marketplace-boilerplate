import { useEffect, useState } from "react";
import {
  Grid,
  Paper,
  Stack,
  Typography,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableFooter,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  TextField,
  FormGroup,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { FiPlus, FiEdit } from "react-icons/fi";
import SaveButton from "@components/SaveButton";
import UpdateDeleteButton from "../../UpdateDeleteButton";
import usePagedTable from "@helpers/usePagedTable";
import { useSwitchState, useSwitchStates } from "@helpers/useSwitchState";
import CoreContractsService from "@services/database/CoreContractsService";
import AuthorizedMarketplacesService from "@services/blockchain/sales/AuthorizedMarketplacesService";

const coreContractsService = new CoreContractsService();
const authorizedMarketplacesService = new AuthorizedMarketplacesService();

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};

const CoreOptions = () => {
  const [authorizedMarketplaces, setAuthorizedMarketplaces] = useState([]);
  const addAuthorizedMarketplaceModal = useSwitchState();
  const [addAuthorizedMarketplaceField, setAddAuthorizedMarketplaceField] =
    useState({
      name: "",
      address: "",
    });
  const [editAuthorizedMarketplaceFields, setEditAuthorizedMarketplaceFields] =
    useState([]);
  const editAuthorizedMarketplaceModal = useSwitchStates(
    authorizedMarketplaces
  );

  useEffect(() => {
    authorizedMarketplacesService.get().then(({ data }) => {
      setAuthorizedMarketplaces(JSON.parse(JSON.stringify(data)));
      setEditAuthorizedMarketplaceFields(JSON.parse(JSON.stringify(data)));
    });
  }, []);

  const [coreContracts, setCoreContracts] = useState([]);
  const addCoreContractModal = useSwitchState();
  const [addCoreContractField, setAddCoreContractField] = useState({
    key: "",
    address: "",
  });
  const [editCoreContractFields, setEditCoreContractFields] = useState([]);
  const editCoreContractModal = useSwitchStates(coreContracts);

  useEffect(() => {
    coreContractsService.get().then(({ data }) => {
      setCoreContracts(JSON.parse(JSON.stringify(data)));
      setEditCoreContractFields(JSON.parse(JSON.stringify(data)));
    });
  }, []);

  const tablePagination = [
    usePagedTable(authorizedMarketplaces),
    usePagedTable(coreContracts),
  ];

  const handleAddAuthorizedMarketplaceBlur = (key) => (e) => {
    const newAm = { ...addAuthorizedMarketplaceField };
    newAm[key] = e.target.value;
    setAddAuthorizedMarketplaceField(newAm);
  };

  const handleEditAuthorizedMarketplaceBlur = (i, key) => (e) => {
    const amf = [...editAuthorizedMarketplaceFields];
    amf[i][key] = e.target.value;
    setEditAuthorizedMarketplaceFields(amf);
  };

  const handleAddCoreContractBlur = (key) => (e) => {
    const newCc = { ...addCoreContractField };
    newCc[key] = e.target.value;
    setAddCoreContractField(newCc);
  };

  const handleEditCoreContractBlur = (i, key) => (e) => {
    const ccf = [...editCoreContractFields];
    ccf[i][key] = e.target.value;
    setEditCoreContractFields(ccf);
  };

  const addCoreContract = async (e) => {
    const key = addCoreContractField.key;
    const address = addCoreContractField.address;
    const { status, data } = await coreContractsService.add(key, address);

    if (status === 201) {
      const contracts = coreContracts.concat(data);
      setAddCoreContractField({ key: "", address: "" });
      setCoreContracts(contracts);
      addCoreContractModal.setInactive();
    }
  };

  const deleteCoreContract = (i) => async (e) => {
    const id = editCoreContractFields[i].id;
    const { status } = await coreContractsService.delete(id);

    if (status === 204) {
      const contracts = coreContracts.filter((c) => c.id !== id);
      addCoreContractModal.setInactive(i)();
      setCoreContracts(contracts);
    }
  };

  const updateCoreContract = (i) => async (e) => {
    const key = editCoreContractFields[i].key;
    const address = editCoreContractFields[i].address;
    const id = editCoreContractFields[i].id;
    const { status, data } = await coreContractsService.update(
      id,
      key,
      address
    );

    if (status === 201) {
      const contracts = coreContracts.filter((c) => c.id !== id);
      contracts.concat(data);
      setCoreContracts(contracts);
      addCoreContractModal.setInactive(i)();
    }
  };

  return (
    <Grid container spacing={2} sx={{ py: 2 }}>
      <Grid item md={8}>
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6" component="h2">
                Authorized marketplaces
              </Typography>
              <IconButton onClick={addAuthorizedMarketplaceModal.setActive}>
                <FiPlus />
              </IconButton>

              <Modal
                open={Boolean(addAuthorizedMarketplaceModal.switchState)}
                onClose={addAuthorizedMarketplaceModal.setInactive}
                aria-labelledby={`addmp-modal-title`}
                aria-describedby={`addmp-modal-description`}
              >
                <Stack component={Paper} spacing={1} sx={modalStyle}>
                  <Typography
                    variant="h6"
                    component="p"
                    id={`addmp-modal-title`}
                  >
                    Add Authorized Marketplace
                  </Typography>
                  <Typography variant="body2">
                    Name is just for internal reference.
                  </Typography>
                  <Stack spacing={1} id={`addmp-modal-description`}>
                    <TextField
                      label="Name"
                      id={`addmp-name-option`}
                      defaultValue={addAuthorizedMarketplaceField.name}
                      onBlur={handleAddAuthorizedMarketplaceBlur("name")}
                    />
                    <TextField
                      label="Address"
                      id={`addmp-address-option`}
                      defaultValue={addAuthorizedMarketplaceField.address}
                      onBlur={handleAddAuthorizedMarketplaceBlur("address")}
                    />
                    <SaveButton
                      variant="contained"
                      child="Add"
                      iconButton={false}
                    />
                  </Stack>
                </Stack>
              </Modal>
            </Stack>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tablePagination[0].rows().map((h, i) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <Typography>{h.name}</Typography>
                      </TableCell>

                      <TableCell>
                        <Typography color="text.secondary">
                          {h.address}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <IconButton
                          onClick={editAuthorizedMarketplaceModal.setActive(i)}
                        >
                          <FiEdit />
                        </IconButton>

                        <Modal
                          open={Boolean(
                            editAuthorizedMarketplaceModal.switchState[i]
                          )}
                          onClose={editAuthorizedMarketplaceModal.setInactive(
                            i
                          )}
                          aria-labelledby={`mp-modal-title-${i}`}
                          aria-describedby={`mp-modal-description-${i}`}
                        >
                          <Stack component={Paper} sx={modalStyle} spacing={1}>
                            <Typography
                              variant="h6"
                              component="p"
                              id={`mp-modal-title-${i}`}
                            >
                              Edit Marketplace: &ldquo;{h.name}&rdquo;
                            </Typography>
                            <Stack spacing={1} id={`mp-modal-description-${i}`}>
                              <TextField
                                label="Name"
                                defaultValue={h.name}
                                id={`mp-name-option-${i}`}
                                onBlur={handleEditAuthorizedMarketplaceBlur(
                                  i,
                                  "name"
                                )}
                              />

                              <UpdateDeleteButton
                                deleteClick={(f) => f}
                                updateClick={(f) => f}
                              />
                            </Stack>
                          </Stack>
                        </Modal>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tablePagination[0].fillRows()}
                </TableBody>
                <TableFooter>
                  <TableRow>{tablePagination[0].pagination()}</TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>
        <Paper sx={{ p: 2, mt: 2 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6" component="h2">
                Core Contracts
              </Typography>
              <IconButton onClick={addCoreContractModal.setActive}>
                <FiPlus />
              </IconButton>

              <Modal
                open={Boolean(addCoreContractModal.switchState)}
                onClose={addCoreContractModal.setInactive}
                aria-labelledby={`addcc-modal-title`}
                aria-describedby={`addcc-modal-description`}
              >
                <Stack component={Paper} spacing={1} sx={modalStyle}>
                  <Typography
                    variant="h6"
                    component="p"
                    id={`addcc-modal-title`}
                  >
                    Add Core Contract
                  </Typography>
                  <Stack spacing={1} id={`addcc-modal-description`}>
                    <TextField
                      label="Key"
                      id={`addcc-key-option`}
                      defaultValue={addCoreContractField.key}
                      onBlur={handleAddCoreContractBlur("key")}
                    />
                    <TextField
                      label="Address"
                      id={`addcc-address-option`}
                      defaultValue={addCoreContractField.address}
                      onBlur={handleAddCoreContractBlur("address")}
                    />
                    <SaveButton
                      variant="contained"
                      child="Add"
                      iconButton={false}
                      click={addCoreContract}
                    />
                  </Stack>
                </Stack>
              </Modal>
            </Stack>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tablePagination[1].rows().map((h, i) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <Typography>{h.key}</Typography>
                      </TableCell>

                      <TableCell>
                        <Typography color="text.secondary">
                          {h.address}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <IconButton
                          onClick={editCoreContractModal.setActive(i)}
                        >
                          <FiEdit />
                        </IconButton>
                        <Modal
                          open={Boolean(editCoreContractModal.switchState[i])}
                          onClose={editCoreContractModal.setInactive(i)}
                          aria-labelledby={`cc-modal-title-${i}`}
                          aria-describedby={`cc-modal-description-${i}`}
                        >
                          <Stack component={Paper} spacing={1} sx={modalStyle}>
                            <Typography
                              variant="h6"
                              component="p"
                              id={`cc-modal-title-${i}`}
                            >
                              Edit Core Contract: &ldquo;{h.key}&rdquo;
                            </Typography>
                            <Typography variant="body2">
                              Key works as internal reference to core functions.
                              Be careful when editing this field.
                            </Typography>
                            <Stack spacing={1} id={`cc-modal-description-${i}`}>
                              <TextField
                                label="Key"
                                defaultValue={h.key}
                                id={`cc-name-option-${i}`}
                                onBlur={handleEditCoreContractBlur(i, "key")}
                              />
                              <TextField
                                label="Address"
                                defaultValue={h.address}
                                id={`cc-address-option-${i}`}
                                onBlur={handleEditCoreContractBlur(
                                  i,
                                  "address"
                                )}
                              />
                              <UpdateDeleteButton
                                deleteClick={deleteCoreContract(i)}
                                updateClick={updateCoreContract(i)}
                              />
                            </Stack>
                          </Stack>
                        </Modal>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tablePagination[1].fillRows()}
                </TableBody>
                <TableFooter>
                  <TableRow>{tablePagination[1].pagination()}</TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>
      </Grid>
      <Grid item md={4}>
        <Paper sx={{ p: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6" component="h2">
              Core Functionality
            </Typography>

            <SaveButton />
          </Stack>
          <Typography variant="body2">
            Pause to protect users&rsquo; assets if something goes wrong
          </Typography>
          <FormGroup>
            <FormControlLabel control={<Switch />} label="Pause" />
          </FormGroup>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default CoreOptions;
