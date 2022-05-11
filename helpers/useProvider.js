import { useState } from "react";

const useProvider = () => {
    const [provider, _setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const setProvider = (provider) => {
        if (provider._isProvider) {
            _setProvider(provider);
            setSigner(provider.getSigner())
        }
    }
    return {provider, setProvider, signer};
}

export default useProvider;