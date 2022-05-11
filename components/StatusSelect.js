import { FormControl, FormLabel, RadioGroup, Radio, FormControlLabel } from "@mui/material";

const StatusSelect = ({ value, change = (f) => f }) => {
  return (
    <FormControl fullWidth={true}>
      <FormLabel id="radio-status">Status</FormLabel>
      <RadioGroup
        aria-labelledby="radio-status"
        defaultValue="All"
        value={value}
        onChange={change}
        name="radio-status-group"
        row
      >
        <FormControlLabel value="All" control={<Radio />} label="All" />
        <FormControlLabel value="For sale" control={<Radio />} label="For sale" />
        <FormControlLabel value="Auction" control={<Radio />} label="Auction" />
      </RadioGroup>
    </FormControl>
  );
};

export default StatusSelect;
