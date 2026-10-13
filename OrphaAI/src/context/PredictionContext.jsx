import { createContext, useContext, useState } from "react";

const PredictionContext = createContext({
  currentDisease: "",
  topCandidates: [],
  currentScreen: "/predict",
  updatePredictionContext: () => {},
});

export function PredictionProvider({ children }) {
  const [currentDisease, setCurrentDisease] = useState("");
  const [topCandidates, setTopCandidates] = useState([]);
  const [currentScreen, setCurrentScreen] = useState("/predict");

  const updatePredictionContext = ({ disease, candidates, screen }) => {
    if (disease !== undefined) setCurrentDisease(disease);
    if (candidates !== undefined) setTopCandidates(candidates);
    if (screen !== undefined) setCurrentScreen(screen);
  };

  return (
    <PredictionContext.Provider
      value={{
        currentDisease,
        topCandidates,
        currentScreen,
        updatePredictionContext,
      }}
    >
      {children}
    </PredictionContext.Provider>
  );
}

export function usePredictionContext() {
  return useContext(PredictionContext);
}
