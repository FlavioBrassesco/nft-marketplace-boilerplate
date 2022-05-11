import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  SvgIcon,
  Typography,
  Stack,
  TableFooter,
  TablePagination,
  Box,
  IconButton,
} from "@mui/material";
import { FaEthereum } from "react-icons/fa";
import {
  FiExternalLink,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from "react-icons/fi";
import { useState } from "react";

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

// TODO pagination
const ItemHistory = ({ history }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

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

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
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
  );
};

export default ItemHistory;
