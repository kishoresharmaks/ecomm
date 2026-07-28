import { Redirect } from "expo-router";

export default function SupportRedirectScreen() {
  return <Redirect href={"/account/support" as never} />;
}
