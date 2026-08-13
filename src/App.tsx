import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Route, Routes } from "react-router";
import Layout from "@/Layout";
import DatabaseProvider from "@/database/DatabaseProvider";
import MostDifficultCards from "@/pages/MostDifficultCards";
import NotFound from "@/pages/NotFound";
import ProfileInfo from "@/pages/ProfileInfo";
import Recommendations from "@/pages/Recommendations";
import Statistics from "@/pages/Statistics";
import ScriptProvider from "@/script/ScriptProvider";

// `ScriptProvider` sits outside `DatabaseProvider` because the written form is
// a standing preference: it is already meaningful before an import and unchanged
// by one.
const App = () => (
  <MantineProvider>
    <ScriptProvider>
      <DatabaseProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<ProfileInfo />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/difficult" element={<MostDifficultCards />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </DatabaseProvider>
    </ScriptProvider>
  </MantineProvider>
);

export default App;
