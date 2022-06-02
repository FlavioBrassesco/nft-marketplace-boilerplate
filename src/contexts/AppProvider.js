import { SiteOptionsProvider } from "./SiteOptions";
import { CollectionsProvider } from "./Collections";
import { Web3Provider } from "./Web3Provider"
export default function AppProvider({ children }) {
  return (
    <Web3Provider>
      <CollectionsProvider>
        <SiteOptionsProvider>{children}</SiteOptionsProvider>
      </CollectionsProvider>
    </Web3Provider>
  );
}
