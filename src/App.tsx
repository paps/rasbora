import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Route, Routes } from "react-router";
import Layout from "@/Layout";
import DatabaseProvider from "@/database/DatabaseProvider";
import DictionaryProvider from "@/cc-cedict/DictionaryProvider";
import AlmostLearnedCards from "@/pages/AlmostLearnedCards";
import CustomizedCards from "@/pages/CustomizedCards";
import LearnedCards from "@/pages/LearnedCards";
import MostDifficultCards from "@/pages/MostDifficultCards";
import NotFound from "@/pages/NotFound";
import ProfileInfo from "@/pages/ProfileInfo";
import Recommendations from "@/pages/Recommendations";
import RiskyCards from "@/pages/RiskyCards";
import Statistics from "@/pages/Statistics";
import ScriptProvider from "@/script/ScriptProvider";

// `ScriptProvider` and `DictionaryProvider` sit outside `DatabaseProvider`
// because both are standing app-wide facts, not the export: the written form is
// a preference, and the dictionary is bundled reference data. Both are already
// meaningful before an import and unchanged by one.
const App = () => (
  <MantineProvider>
    <ScriptProvider>
      <DictionaryProvider>
        <DatabaseProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<ProfileInfo />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/difficult" element={<MostDifficultCards />} />
                <Route path="/risky" element={<RiskyCards />} />
                <Route
                  path="/almost-learned"
                  element={<AlmostLearnedCards />}
                />
                <Route path="/learned" element={<LearnedCards />} />
                <Route path="/customized" element={<CustomizedCards />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </DatabaseProvider>
      </DictionaryProvider>
    </ScriptProvider>
  </MantineProvider>
);

export default App;
