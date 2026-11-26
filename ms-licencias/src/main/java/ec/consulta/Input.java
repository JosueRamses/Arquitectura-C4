package ec.consulta;
public final class Input {
 private Input(){}
 public static boolean cedula(String n){
  if(n==null||!n.matches("\\d{10}"))return false;
  int province=Integer.parseInt(n.substring(0,2));
  if(!((province>=1&&province<=24)||province==30)||n.charAt(2)>'5')return false;
  int sum=0;for(int i=0;i<9;i++){int v=n.charAt(i)-'0';if(i%2==0){v*=2;if(v>9)v-=9;}sum+=v;}
  return (10-sum%10)%10==n.charAt(9)-'0';
 }
 public static boolean ruc(String n){return n!=null&&n.matches("\\d{13}")&&n.endsWith("001")&&cedula(n.substring(0,10));}
 public static void requireRuc(String n){if(!ruc(n))throw new ApiException(400,"RUC de persona natural inválido.");}
}
