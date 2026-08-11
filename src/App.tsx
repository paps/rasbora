import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Route, Routes } from "react-router";
import DatabaseProvider from "@/database/DatabaseProvider";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";

const App = () => (
  <MantineProvider>
    <DatabaseProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DatabaseProvider>
  </MantineProvider>
);

export default App;
