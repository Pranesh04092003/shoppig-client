import Address from "@/components/shopping-view/address";
import img from "../../assets/account.jpg";
import { useDispatch, useSelector } from "react-redux";
import UserCartItemsContent from "@/components/shopping-view/cart-items-content";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { createNewOrder } from "@/store/shop/order-slice";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

function ShoppingCheckout() {
  const { cartItems } = useSelector((state) => state.shopCart);
  const { user } = useSelector((state) => state.auth);
  const { approvalURL, razorpayOrderId, razorpayKeyId } = useSelector(
    (state) => state.shopOrder
  );
  const [currentSelectedAddress, setCurrentSelectedAddress] = useState(null);
  const [isPaymentStart, setIsPaymemntStart] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);  // Track payment success
  const [paymentFailure, setPaymentFailure] = useState(false);  // Track payment failure
  const dispatch = useDispatch();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Total cart amount calculation
  const totalCartAmount =
    cartItems && cartItems.items && cartItems.items.length > 0
      ? cartItems.items.reduce(
          (sum, currentItem) =>
            sum +
            (currentItem?.salePrice > 0
              ? currentItem?.salePrice
              : currentItem?.price) *
              currentItem?.quantity,
          0
        )
      : 0;

  // Initialize Razorpay script on component mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      console.log("Razorpay script loaded successfully!");
    };
    script.onerror = () => {
      console.error("Failed to load Razorpay script.");
    };
    document.body.appendChild(script);
  }, []);

  // Function to handle Razorpay payment initiation
  function handleInitiateRazorpayPayment() {
    if (cartItems.length === 0) {
      toast({
        title: "Your cart is empty. Please add items to proceed",
        variant: "destructive",
      });
      return;
    }

    if (currentSelectedAddress === null) {
      toast({
        title: "Please select one address to proceed.",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      userId: user?.id,
      userName: user?.userName, // Include the username here
      cartId: cartItems?._id,
      cartItems: cartItems.items.map((singleCartItem) => ({
        productId: singleCartItem?.productId,
        title: singleCartItem?.title,
        image: singleCartItem?.image,
        price: singleCartItem?.salePrice > 0 ? singleCartItem?.salePrice : singleCartItem?.price,
        quantity: singleCartItem?.quantity,
      })),
      addressInfo: {
        addressId: currentSelectedAddress?._id,
        address: currentSelectedAddress?.address,
        city: currentSelectedAddress?.city,
        pincode: currentSelectedAddress?.pincode,
        phone: currentSelectedAddress?.phone,
        notes: currentSelectedAddress?.notes,
      },
      orderStatus: "pending",
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      totalAmount: totalCartAmount,
      orderDate: new Date(),
      orderUpdateDate: new Date(),
      paymentId: "",
      payerId: "",
    };

    dispatch(createNewOrder(orderData)).then((data) => {
      if (data?.payload?.success) {
        // Initiate Razorpay payment if the order is created successfully
        const options = {
          key: "rzp_live_ehoqDzG6UdMjah", // Use your Razorpay live key here
          amount: totalCartAmount * 100, // Amount in paise (100 paise = 1 INR)
          currency: "INR",
          name: "Shopping Cart",
          description: "Order Payment",
          order_id: data?.payload?.razorpayOrderId, // Order ID from backend
          handler: async function (response) {
            const paymentDetails = {
              paymentId: response.razorpay_payment_id,
              payerId: response.razorpay_payer_id,
              orderId: data.payload.orderId, // Backend order ID
            };

            // Call the API to capture the payment
            try {
              const res = await fetch("https://shopping-e-commerce-razorpay.onrender.com/api/shop/order/capture", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(paymentDetails),
              });

              const result = await res.json();

              if (result.success) {
                // If payment capture is successful, display success message
                setPaymentSuccess(true);
                setPaymentFailure(false);  // Reset failure state if payment is successful
                toast({
                  title: "Payment Successful!",
                  description: "Your payment has been successfully processed.",
                  variant: "success",
                });

                // Redirect to the payment success page
                navigate("/shop/payment-success");
              } else {
                setPaymentFailure(true);  // Set failure state to true
                setPaymentSuccess(false); // Set success state to false
                toast({
                  title: "Payment Failed!",
                  description: "There was an issue capturing your payment.",
                  variant: "destructive",
                });
              }
            } catch (error) {
              setPaymentFailure(true);  // Set failure state to true
              setPaymentSuccess(false); // Set success state to false
              toast({
                title: "Error!",
                description: "An error occurred while processing your payment.",
                variant: "destructive",
              });
            }
          },
          prefill: {
            name: user?.userName,
            email: user?.email, // Ensure email is available in the user state
          },
          theme: {
            color: "#F37254", // Customize theme color
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open(); // Open the Razorpay payment modal
      } else {
        setIsPaymemntStart(false);
      }
    });
  }

  // Redirect if approvalURL is available
  if (approvalURL) {
    window.location.href = approvalURL;
  }

  return (
    <div className="flex flex-col">
      <div className="relative h-[300px] w-full overflow-hidden">
        <img src={img} className="h-full w-full object-cover object-center" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5">
        <Address
          selectedId={currentSelectedAddress}
          setCurrentSelectedAddress={setCurrentSelectedAddress}
        />
        <div className="flex flex-col gap-4">
          {cartItems && cartItems.items && cartItems.items.length > 0
            ? cartItems.items.map((item) => <UserCartItemsContent cartItem={item} />)
            : null}
          <div className="mt-8 space-y-4">
            <div className="flex justify-between">
              <span className="font-bold">Total</span>
              <span className="font-bold">₹{totalCartAmount}</span>
            </div>
          </div>
          <div className="mt-4 w-full">
            <Button onClick={handleInitiateRazorpayPayment} className="w-full">
              {isPaymentStart ? "Processing Razorpay Payment..." : "Checkout with Razorpay"}
            </Button>
          </div>
          {paymentSuccess && (
            <div className="mt-4 text-green-600 font-bold">
              Payment Successful! Your order has been placed.
            </div>
          )}
          {paymentFailure && (
            <div className="mt-4 text-red-600 font-bold">
              Payment Failed! Please try again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShoppingCheckout;
