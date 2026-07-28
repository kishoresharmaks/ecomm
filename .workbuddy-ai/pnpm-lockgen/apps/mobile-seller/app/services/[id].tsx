import { useLocalSearchParams } from "expo-router";
import { SellerServiceFormScreen } from "../../src/features/seller/service-form-screen";

export default function EditSellerServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SellerServiceFormScreen serviceId={decodeURIComponent(id ?? "")} />;
}
