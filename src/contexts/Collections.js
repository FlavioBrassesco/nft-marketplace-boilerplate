import { useReducer, useCallback, createContext } from "react";
import CollectionsService from "@services/database/CollectionsService";

export const Collections = createContext();
const collectionsService = new CollectionsService();

const initialState = {
  loading: true,
  error: "",
  data: null,
};

function reducer(state, action) {
  const { data } = state;

  switch (action.type) {
    case "GET_COLLECTIONS_SUCCESS":
      return {
        ...state,
        loading: false,
        data: action.payload,
      };
    case "GET_COLLECTIONS_ERROR":
      return {
        ...state,
        loading: false,
        data: [],
        error: action.payload,
      };
    case "SET_COLLECTION_FEE":
      return {
        ...state,
        data: data.map((d) => {
          if (d.address !== action.payload.address) return d;
          const nd = { ...d };
          nd.fee = action.payload.fee;
          return nd;
        }),
      };
    case "SET_COLLECTION_FLOORPRICE":
      return {
        ...state,
        data: data.map((d) => {
          if (d.address !== action.payload.address) return d;
          const nd = { ...d };
          nd.floorPrice = action.payload.floorPrice;
          return nd;
        }),
      };
    case "ADD_COLLECTION_WHITELIST":
      console.log("ADD_COLLECTION_WHITELIST");
      return {
        ...state,
        data: data.map((d) => {
          if (d.address !== action.payload.address) return d;
          const nd = { ...d };
          nd.whitelist = action.payload.whitelist;
          return nd;
        }),
      };
    case "ADD_COLLECTION_WHITELIST_ERROR":
      console.log("ADD_COLLECTION_WHITELIST_ERROR");
      return {
        ...state,
        error: action.payload,
      };
    default:
      return state;
  }
}

export function CollectionsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const getCollections = useCallback(async (provider) => {
    collectionsService
      .getAll(provider)
      .then((data) =>
        dispatch({ type: "GET_COLLECTIONS_SUCCESS", payload: data })
      )
      .catch((e) => dispatch({ type: "GET_COLLECTIONS_ERROR", payload: e }));
  }, []);

  const setFee = useCallback(async (provider, address, fee) => {
    collectionsService
      .setFee(provider, address, fee)
      .then((data) => {
        dispatch({ type: "SET_COLLECTION_FEE", payload: { address, fee } });
      })
      .catch((e) => dispatch({ type: "SET_COLLECTION_FEE_ERROR", payload: e }));
  }, []);

  const setFloorPrice = useCallback(async (provider, address, fee) => {
    collectionsService
      .setFloorPrice(provider, address, fee)
      .then((data) => {
        dispatch({
          type: "SET_COLLECTION_FLOORPRICE",
          payload: { address, fee },
        });
      })
      .catch((e) =>
        dispatch({ type: "SET_COLLECTION_FLOORPRICE_ERROR", payload: e })
      );
  }, []);

  const addWhitelistedCollection = useCallback(async (provider, address) => {
    collectionsService
      .addWhitelistedCollection(provider, address)
      .then((data) => {
        dispatch({
          type: "ADD_COLLECTION_WHITELIST",
          payload: { address, whitelist: true },
        });
      })
      .catch((e) =>
        dispatch({ type: "ADD_COLLECTION_WHITELIST_ERROR", payload: e })
      );
  }, []);

  return (
    <Collections.Provider
      value={{
        ...state,
        getCollections,
        setFee,
        setFloorPrice,
        addWhitelistedCollection,
      }}
    >
      {children}
    </Collections.Provider>
  );
}

export default Collections;
