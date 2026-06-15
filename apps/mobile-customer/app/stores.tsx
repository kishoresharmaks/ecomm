import { Redirect, type Href } from "expo-router";

export default function StoresAliasScreen() {
  return <Redirect href={"/local-shops" as Href} />;
}
