import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Route, Routes } from "react-router";
import Layout from "@/Layout";
import DatabaseProvider from "@/database/DatabaseProvider";
import LoadFlashcards from "@/pages/LoadFlashcards";
import MostDifficultCards from "@/pages/MostDifficultCards";
import NotFound from "@/pages/NotFound";
import Recommendations from "@/pages/Recommendations";
import Statistics from "@/pages/Statistics";

const App = () => (
  <MantineProvider>
    <DatabaseProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<LoadFlashcards />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/difficult" element={<MostDifficultCards />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </DatabaseProvider>
  </MantineProvider>
);

export default App;
