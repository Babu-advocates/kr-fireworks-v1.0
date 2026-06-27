import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Package, Mail, Calendar, MapPin, Phone, IndianRupee, LogOut, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

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
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else {
        fetchUserData();
      }
    }
  }, [user, authLoading, navigate]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);
      setFullName(profileData?.full_name || '');

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders((ordersData || []) as Order[]);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, full_name: fullName });
      setEditMode(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { className: "bg-muted text-muted-foreground" },
      processing: { className: "bg-secondary/10 text-secondary border-secondary/30" },
      completed: { className: "bg-primary/10 text-primary border-primary/30" },
      cancelled: { className: "bg-destructive/10 text-destructive border-destructive/30" }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant="outline" className={config.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-16">
          <div className="text-center">
            <User className="w-16 h-16 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Account</h1>
            <p className="text-muted-foreground">Manage your account and view your orders</p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="profile">Account Details</TabsTrigger>
            <TabsTrigger value="orders">My Orders</TabsTrigger>
          </TabsList>

          {/* Account Details Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>Manage your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={profile.email}
                        disabled
                        className="border-0 bg-transparent p-0 h-auto"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    {editMode ? (
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1">{profile.full_name || 'Not set'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {editMode ? (
                      <>
                        <Button onClick={handleUpdateProfile}>Save Changes</Button>
                        <Button variant="outline" onClick={() => {
                          setEditMode(false);
                          setFullName(profile.full_name || '');
                        }}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setEditMode(true)}>Edit Profile</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Account ID</span>
                    <span className="text-sm font-mono">{profile.id.slice(0, 8)}...</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Total Orders</span>
                    <span className="text-sm font-semibold">{orders.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
                  <p className="text-muted-foreground mb-6">Start shopping to see your orders here</p>
                  <Button onClick={() => navigate('/shop')}>Browse Products</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <CardTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-primary" />
                            Order #{order.id.slice(0, 8)}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(order.created_at).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="flex items-center gap-1">
                              <IndianRupee className="w-4 h-4" />
                              {order.total_amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Order Items */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Items</h4>
                          <div className="grid gap-2">
                            {order.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-16 h-16 object-contain rounded border"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium line-clamp-1">{item.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Quantity: {item.quantity} × {item.price}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        {/* Shipping Address */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Delivery Address
                          </h4>
                          <div className="text-sm space-y-1 p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium">{order.customer_name}</p>
                            <p className="text-muted-foreground whitespace-pre-line">{order.shipping_address}</p>
                            <p className="text-muted-foreground">{order.city}, {order.state} - {order.pincode}</p>
                            <div className="flex items-center gap-2 pt-2">
                              <Phone className="w-3 h-3" />
                              <span>{order.customer_phone}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default Profile;