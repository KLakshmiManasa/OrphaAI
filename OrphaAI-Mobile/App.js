import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import DiseaseSearchScreen from "./screens/DiseaseSearchScreen";
import PredictionScreen from "./screens/PredictionScreen";
import ChatbotScreen from "./screens/ChatbotScreen";
import DrugLibraryScreen from "./screens/DrugLibraryScreen";
import DiseaseLibraryScreen from "./screens/DiseaseLibraryScreen";
import InteractionNetworkScreen from "./screens/InteractionNetworkScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
        />

        <Stack.Screen
          name="Disease Search"
          component={DiseaseSearchScreen}
        />

        <Stack.Screen
          name="Prediction"
          component={PredictionScreen}
        />

        <Stack.Screen
          name="Chatbot"
          component={ChatbotScreen}
        />

        <Stack.Screen
          name="Drug Library"
          component={DrugLibraryScreen}
        />

        <Stack.Screen
          name="Disease Library"
          component={DiseaseLibraryScreen}
        />

        <Stack.Screen
          name="Interaction Network"
          component={InteractionNetworkScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
