import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import Layout from "@/Layout";
import DatabaseProvider from "@/database/DatabaseProvider";
import DictionaryProvider from "@/cc-cedict/DictionaryProvider";
import AlmostLearnedCards from "@/pages/AlmostLearnedCards";
import CustomizedCards from "@/pages/CustomizedCards";
import LearnedCards from "@/pages/LearnedCards";
import LoadFile from "@/pages/LoadFile";
import MostDifficultCards from "@/pages/MostDifficultCards";
import NotFound from "@/pages/NotFound";
import ProfileInfo from "@/pages/ProfileInfo";
import Recommendations from "@/pages/Recommendations";
import RiskyCards from "@/pages/RiskyCards";
import Statistics from "@/pages/Statistics";
import ScriptProvider from "@/script/ScriptProvider";
import { useDatabase } from "@/database/context";

/**
 * What `/` shows: the profile, once there is an export to read it from, and the
 * loader when no export is available. Layout waits for the saved file and
 * profile to be restored before mounting routes, so a returning reader stays
 * on the profile page instead of being redirected while storage is loading.
 */
const Landing = () => {
  const { database } = useDatabase();

  return database ? <ProfileInfo /> : <Navigate to="/load" replace />;
};

// `ScriptProvider` and `DictionaryProvider` sit outside `DatabaseProvider`
// because both are standing app-wide facts, not the export: the written form is
// a preference, and the dictionary is bundled reference data. Both are already
// meaningful before an import and unchanged by one.
//
// `defaultColorScheme="auto"` is the third such fact and the only one Mantine
// keeps for itself: it means "follow the browser" until the reader picks light
// or dark on `Load Pleco file`, after which Mantine's own `localStorage` entry
// decides. Mantine's default is `light`, which would ignore the preference the
// browser already states.
const App = () => (
  <MantineProvider defaultColorScheme="auto">
    <ScriptProvider>
      <DictionaryProvider>
        <DatabaseProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/load" element={<LoadFile />} />
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
