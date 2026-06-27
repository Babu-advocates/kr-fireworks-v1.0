import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShoppingCart, Truck, Shield, CreditCard, MapPin, QrCode, AlertCircle, Check } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const checkoutSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"),
  address: z.string().min(10, "Please enter a complete address"),
  city: z.string().min(2, "Please enter a valid city"),
  state: z.string().min(2, "Please enter a valid state"),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Please enter a valid 6-digit pincode"),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

const Checkout = () => {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart } = useCart();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"shipping" | "payment">("shipping");
  const [transactionId, setTransactionId] = useState("");
  const [transactionIdError, setTransactionIdError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutFormData, string>>>({});
  const [formData, setFormData] = useState<CheckoutFormData>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const handleInputChange = (field: keyof CheckoutFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const result = checkoutSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CheckoutFormData, string>> = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as keyof CheckoutFormData;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setStep("payment");
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransactionIdError("");

    const cleanTxnId = transactionId.trim();
    if (!cleanTxnId) {
      setTransactionIdError("Transaction ID is required to verify your payment.");
      return;
    }
    if (!/^\d{12}$/.test(cleanTxnId)) {
      setTransactionIdError("Please enter a valid 12-digit UPI Transaction ID/Ref No.");
      return;
    }

    setIsSubmitting(true);

    try {
      const fullShippingAddress = `${formData.address}\n\n[Payment Details: UPI/QR - Txn ID: ${cleanTxnId}]`;

      // Create order in database
      const { error } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id || null,
          customer_name: formData.fullName,
          customer_email: formData.email,
          customer_phone: formData.phone,
          shipping_address: fullShippingAddress,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          total_amount: totalPrice,
          status: 'pending',
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            unit: item.unit,
            image: item.image
          }))
        });

      if (error) throw error;

      // Reduce stock for each product in the order
      for (const item of items) {
        // First get current stock
        const { data: productData, error: fetchError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (fetchError) {
          console.error('Error fetching product stock:', fetchError);
          continue;
        }

        const newStock = Math.max(0, (productData?.stock || 0) - item.quantity);

        // Update the stock
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.id);

        if (updateError) {
          console.error('Error updating product stock:', updateError);
        }
      }

      toast({
        title: "Order Placed Successfully!",
        description: "Your order has been confirmed. You will receive an email confirmation shortly.",
      });

      clearCart();
      navigate("/", { replace: true });
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: "Error",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-16">
          <div className="text-center py-16">
            <ShoppingCart className="w-20 h-20 mx-auto text-muted-foreground mb-6" />
            <h2 className="text-2xl font-bold mb-3">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Add some items to your cart to proceed to checkout.</p>
            <Button onClick={() => navigate("/shop")}>Continue Shopping</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6 gap-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <h1 className="text-3xl font-bold mb-8 text-center md:text-left">Checkout</h1>

        {/* Step Indicator */}
        <div className="flex items-center justify-center max-w-xl mx-auto mb-8 px-4">
          <div className="flex items-center w-full">
            {/* Step 1 */}
            <div className="flex flex-col items-center relative flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all duration-300 ${
                step === "shipping" 
                  ? "bg-primary border-primary text-primary-foreground shadow-[0_0_12px_rgba(239,68,68,0.4)]" 
                  : "bg-green-600 border-green-600 text-white"
              }`}>
                {step === "payment" ? <Check className="w-4 h-4 animate-scale-in" /> : "1"}
              </div>
              <span className={`text-xs font-semibold mt-2 transition-colors duration-300 ${
                step === "shipping" ? "text-primary" : "text-green-600"
              }`}>Shipping Details</span>
            </div>

            {/* Connector */}
            <div className={`h-0.5 flex-1 mx-2 border-t-2 transition-all duration-300 ${
              step === "payment" ? "border-green-600" : "border-muted"
            }`} />

            {/* Step 2 */}
            <div className="flex flex-col items-center relative flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all duration-300 ${
                step === "payment" 
                  ? "bg-primary border-primary text-primary-foreground shadow-[0_0_12px_rgba(239,68,68,0.4)]" 
                  : "bg-muted border-muted text-muted-foreground"
              }`}>
                2
              </div>
              <span className={`text-xs font-semibold mt-2 transition-colors duration-300 ${
                step === "payment" ? "text-primary" : "text-muted-foreground"
              }`}>Pay & Confirm</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Shipping Form or Payment Screen */}
          <div className="lg:col-span-2">
            {step === "shipping" ? (
              <Card className="border-border/50 hover:shadow-md transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Shipping Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProceedToPayment} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name *</Label>
                        <Input
                          id="fullName"
                          placeholder="Enter your full name"
                          value={formData.fullName}
                          onChange={(e) => handleInputChange("fullName", e.target.value)}
                          className={errors.fullName ? "border-destructive" : ""}
                        />
                        {errors.fullName && (
                          <p className="text-xs text-destructive">{errors.fullName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          className={errors.email ? "border-destructive" : ""}
                        />
                        {errors.email && (
                          <p className="text-xs text-destructive">{errors.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter 10-digit phone number"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className={errors.phone ? "border-destructive" : ""}
                      />
                      {errors.phone && (
                        <p className="text-xs text-destructive">{errors.phone}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address *</Label>
                      <Textarea
                        id="address"
                        placeholder="Enter your complete address"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        className={errors.address ? "border-destructive" : ""}
                        rows={3}
                      />
                      {errors.address && (
                        <p className="text-xs text-destructive">{errors.address}</p>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          placeholder="City"
                          value={formData.city}
                          onChange={(e) => handleInputChange("city", e.target.value)}
                          className={errors.city ? "border-destructive" : ""}
                        />
                        {errors.city && (
                          <p className="text-xs text-destructive">{errors.city}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          placeholder="State"
                          value={formData.state}
                          onChange={(e) => handleInputChange("state", e.target.value)}
                          className={errors.state ? "border-destructive" : ""}
                        />
                        {errors.state && (
                          <p className="text-xs text-destructive">{errors.state}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input
                          id="pincode"
                          placeholder="6-digit pincode"
                          value={formData.pincode}
                          onChange={(e) => handleInputChange("pincode", e.target.value)}
                          className={errors.pincode ? "border-destructive" : ""}
                        />
                        {errors.pincode && (
                          <p className="text-xs text-destructive">{errors.pincode}</p>
                        )}
                      </div>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap gap-6 pt-4 text-sm text-muted-foreground border-t">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        <span>Secure Checkout</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary" />
                        <span>Fast Delivery</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-primary" />
                        <span>UPI & Cards</span>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-12 text-lg font-bold"
                    >
                      Proceed to Payment - ₹{totalPrice.toFixed(2)}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-b border-border/30">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <QrCode className="w-5 h-5 text-primary animate-pulse" />
                    UPI Payment (Scan & Pay)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-800 dark:text-yellow-200 rounded-lg p-4 flex gap-3 text-sm">
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">Payment Steps:</p>
                      <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                        <li>Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app.</li>
                        <li>Transfer the exact total amount of <span className="font-bold text-primary">₹{totalPrice.toFixed(2)}</span>.</li>
                        <li>After success, copy the <span className="font-semibold text-foreground">12-digit UPI UTR / Transaction Ref ID</span> from the transaction details and enter it below.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center py-6 bg-muted/20 rounded-xl border border-dashed border-border/60">
                    <div className="text-center mb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Scan & Pay Amount</p>
                      <p className="text-3xl font-black text-primary tracking-tight">₹{totalPrice.toFixed(2)}</p>
                    </div>
                    
                    <div className="relative group p-2 bg-white rounded-2xl shadow-md border border-border/60 transition-transform duration-300 hover:scale-105">
                      <img 
                        src="/payment-qr.jpg" 
                        alt="Payment QR Code" 
                        className="w-64 h-64 md:w-72 md:h-72 object-contain rounded-xl"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground mt-4 font-medium flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-green-600" />
                      100% Secure Direct UPI Transfer
                    </p>
                  </div>

                  <form onSubmit={handlePlaceOrder} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="transactionId" className="text-sm font-semibold flex items-center gap-1">
                        UPI Transaction ID / UTR (12 Digits) *
                      </Label>
                      <Input
                        id="transactionId"
                        type="text"
                        maxLength={12}
                        placeholder="e.g., 619283746501"
                        value={transactionId}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, ""); // Allow only digits
                          setTransactionId(val);
                          if (transactionIdError) setTransactionIdError("");
                        }}
                        className={`h-12 text-lg tracking-wider text-center font-mono ${transactionIdError ? "border-destructive" : ""}`}
                      />
                      {transactionIdError && (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {transactionIdError}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground text-center">
                        Find the 12-digit number (starts with 3, 4, 5, 6, etc.) in your payment history details.
                      </p>
                    </div>

                    <div className="flex gap-4 pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-1/3 h-12 font-semibold"
                        onClick={() => setStep("shipping")}
                        disabled={isSubmitting}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <Button 
                        type="submit" 
                        className="w-2/3 h-12 text-lg font-bold"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Placing Order..." : "Verify & Place Order"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 object-contain rounded border"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      <p className="text-sm font-semibold">{item.price}</p>
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-green-600 font-medium">FREE</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">₹{totalPrice.toFixed(2)}</span>
                </div>

                <p className="text-xs text-muted-foreground text-center font-medium">
                  Payment Method: UPI QR Scan & Pay
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Checkout;