export function generateStaticParams() {
  return [{ productId: 'placeholder' }];
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
