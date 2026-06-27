import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, LogOut, Menu, Package, ArrowLeft, Calendar, User, Phone, Mail, MapPin, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import krLogo from "@/assets/kr-fireworks-logo.png";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  city: string;
  state: string;
  pincode: string;
  total_amount: number;
  status: string;
  items: any[];
  created_at: string;
  user_id: string | null;
}

const AdminOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAuth();
    fetchOrders();
  }, []);

  const checkAdminAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate('/admin');
      return;
    }

    const { data: isAdminData } = await supabase.rpc('is_admin', {
      _user_id: session.user.id
    });

    if (!isAdminData) {
      await supabase.auth.signOut();
      navigate('/admin');
      return;
    }

    const { data: adminDetails } = await supabase
      .from('admin')
      .select('username, email')
      .eq('user_id', session.user.id)
      .maybeSingle();

    setAdminUser({
      id: session.user.id,
      username: adminDetails?.username || 'Admin',
      email: adminDetails?.email || session.user.email
    });
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(orders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      ));

      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully.",
    });
    navigate('/admin');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "outline" as const, className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
      processing: { variant: "outline" as const, className: "bg-blue-100 text-blue-700 border-blue-200" },
      shipped: { variant: "outline" as const, className: "bg-orange-100 text-orange-700 border-orange-200" },
      delivered: { variant: "outline" as const, className: "bg-green-100 text-green-700 border-green-200" },
      completed: { variant: "outline" as const, className: "bg-green-100 text-green-700 border-green-200" }, // Legacy support
      cancelled: { variant: "outline" as const, className: "bg-red-100 text-red-700 border-red-200" }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>
    );
  };

  if (!adminUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Admin Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Logo & Title */}
            <div className="flex flex-col items-start gap-1 select-none">
              <img
                src={krLogo}
                alt="KR Fireworks"
                className="h-10 md:h-12 object-contain"
              />
              <p className="text-sm font-semibold text-red-600 italic tracking-wide font-serif">
                'n' joy with Every moments...
              </p>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <Link to="/admin/dashboard" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
                Dashboard
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
              <Link to="/admin/products" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
                Products
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
              <Link to="/admin/categories" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
                Categories
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
              <Link to="/admin/orders" className="text-primary transition-all duration-300 font-medium relative">
                Orders
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />
              </Link>
              <Link to="/admin/users" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
                Users
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
              <Link to="/admin/reviews" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
                Reviews
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-lg border border-border/50">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{adminUser.username}</p>
                  <p className="text-xs text-muted-foreground">{adminUser.email}</p>
                </div>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  Admin
                </Badge>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="hidden md:flex hover:bg-destructive/10 hover:text-destructive transition-all duration-300 group"
              >
                <LogOut className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                Logout
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <Menu className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-2 animate-in slide-in-from-top duration-300">
              <div className="py-2 border-b border-border">
                <p className="text-sm font-semibold text-foreground">{adminUser.username}</p>
                <p className="text-xs text-muted-foreground">{adminUser.email}</p>
              </div>
              <Link to="/admin/dashboard" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
                Dashboard
              </Link>
              <Link to="/admin/products" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
                Products
              </Link>
              <Link to="/admin/categories" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
                Categories
              </Link>
              <Link to="/admin/orders" className="block py-2 text-primary transition-colors font-medium">
                Orders
              </Link>
              <Link to="/admin/users" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
                Users
              </Link>
              <Link to="/admin/reviews" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
                Reviews
              </Link>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="w-full justify-start hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6 gap-2"
          onClick={() => navigate('/admin/dashboard')}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h2 className="text-4xl font-black bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-2">
            Order Management
          </h2>
          <p className="text-muted-foreground text-lg">View and manage all customer orders</p>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-xl font-semibold mb-2">No orders yet</p>
              <p className="text-muted-foreground">Orders will appear here once customers place them.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 mb-2">
                        <Package className="w-5 h-5 text-primary" />
                        Order #{order.id.slice(0, 8)}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(order.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(order.status)}
                      <Select value={order.status} onValueChange={(value) => handleStatusChange(order.id, value)}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Customer Details */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Customer Details</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{order.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{order.customer_email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{order.customer_phone}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div className="text-sm">
                            <p className="whitespace-pre-line">{order.shipping_address}</p>
                            <p>{order.city}, {order.state} - {order.pincode}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Order Items</h3>
                      <div className="space-y-2">
                        {order.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                            <div className="flex items-center gap-2">
                              <img src={item.image} alt={item.name} className="w-10 h-10 object-contain rounded" />
                              <div>
                                <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                                <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold">{item.price}</span>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-lg font-bold">Total Amount</span>
                        <span className="text-2xl font-black text-primary flex items-center">
                          <IndianRupee className="w-5 h-5" />
                          {order.total_amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminOrders;