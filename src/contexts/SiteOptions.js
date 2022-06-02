import { useReducer, useCallback, createContext } from "react";
import SiteOptionsService from "@services/database/SiteOptionsService";

export const SiteOptions = createContext();
const siteOptionsService = new SiteOptionsService();

const initialState = {
  loading: true,
  error: "",
  data: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "GET_OPTIONS_SUCCESS":
      return {
        ...state,
        loading: false,
        data: action.payload,
      };
    case "GET_OPTIONS_ERROR":
      return {
        ...state,
        loading: false,
        data: {},
        error: action.payload,
      };
    default:
      return state;
  }
}

export function SiteOptionsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchOptions = useCallback(async () => {
    siteOptionsService
      .get()
      .then(({ data }) =>
        dispatch({ type: "GET_OPTIONS_SUCCESS", payload: data })
      )
      .catch((e) => dispatch({ type: "GET_OPTIONS_ERROR", payload: e }));
  }, []);

  const updateOptions = async (options) => {
    siteOptionsService
      .update(options)
      .then(({ data }) =>
        dispatch({ type: "GET_OPTIONS_SUCCESS", payload: data })
      )
      .catch((e) => dispatch({ type: "GET_OPTIONS_ERROR", payload: e }));
  };

  return (
    <SiteOptions.Provider value={{ ...state, fetchOptions, updateOptions }}>
      {children}
    </SiteOptions.Provider>
  );
}

export default SiteOptions;
