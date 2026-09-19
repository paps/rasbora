import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Route, Routes } from "react-router";
import Layout from "@/Layout";
import LinkedExport from "@/LinkedExport";
import DatabaseProvider from "@/database/DatabaseProvider";
import DictionaryProvider from "@/cc-cedict/DictionaryProvider";
import About from "@/pages/About";
import AlmostLearnedCards from "@/pages/AlmostLearnedCards";
import CardCount from "@/pages/CardCount";
import CustomizedCards from "@/pages/CustomizedCards";
import IncomingReviews from "@/pages/IncomingReviews";
import LearnedCards from "@/pages/LearnedCards";
import Lapses from "@/pages/Lapses";
import LearningDistribution from "@/pages/LearningDistribution";
import Leeches from "@/pages/Leeches";
import NewCards from "@/pages/NewCards";
import LoadFile from "@/pages/LoadFile";
import NotFound from "@/pages/NotFound";
import ProfileInfo from "@/pages/ProfileInfo";
import ViewCard from "@/pages/ViewCard";
import Streaks from "@/pages/Streaks";
import ScriptProvider from "@/script/ScriptProvider";

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
              <LinkedExport>
                <Routes>
                  <Route path="/" element={<About />} />
                  <Route path="/load" element={<LoadFile />} />
                  <Route path="/profile" element={<ProfileInfo />} />
                  <Route path="/card-count" element={<CardCount />} />
                  <Route
                    path="/learning-distribution"
                    element={<LearningDistribution />}
                  />
                  <Route
                    path="/incoming-reviews"
                    element={<IncomingReviews />}
                  />
                  <Route path="/card" element={<ViewCard />} />
                  <Route path="/new" element={<NewCards />} />
                  <Route path="/leeches" element={<Leeches />} />
                  <Route path="/lapses" element={<Lapses />} />
                  <Route
                    path="/almost-learned"
                    element={<AlmostLearnedCards />}
                  />
                  <Route path="/learned" element={<LearnedCards />} />
                  <Route path="/streaks" element={<Streaks />} />
                  <Route path="/customized" element={<CustomizedCards />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </LinkedExport>
            </Layout>
          </BrowserRouter>
        </DatabaseProvider>
      </DictionaryProvider>
    </ScriptProvider>
  </MantineProvider>
);

export default App;
