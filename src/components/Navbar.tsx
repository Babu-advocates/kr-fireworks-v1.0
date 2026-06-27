import { Button } from "@/components/ui/button";
import { Menu, User, LogOut, Search, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { CartDrawer } from "@/components/CartDrawer";
import { NavLink } from "@/components/NavLink";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Sync search query with URL params
  useEffect(() => {
    const query = searchParams.get('search');
    if (query) {
      setSearchQuery(query);
      setIsSearchOpen(true);
    } else if (location.pathname === '/') {
      // Only clear if on home page and no query, to allow navigating away without clearing immediately
      // But actually, we want the input to reflect the URL.
      // If we navigate to home without search, clear it.
      setSearchQuery("");
      // Don't force close if user is just landing, but maybe if they cleared it.
    }
  }, [searchParams, location.pathname]);

  const handleSearch = (query: string) => {
    // If on home page, live update
    if (location.pathname === '/') {
      navigate(`/?search=${encodeURIComponent(query)}`, { replace: true });
    } else {
      // If not on home page, do nothing here (wait for enter) 
      // OR optimize to navigate immediately? 
      // navigating immediately from non-home causes focus loss.
    }
  };

  const handleManualSubmit = () => {
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false); // Can close on manual submit if desired, or keep open
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed Out",
      description: "You have been signed out successfully.",
    });
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 md:gap-3 group cursor-pointer">
            <img
              src="/logo.png"
              alt="KR Fireworks Logo"
              className="w-8 h-8 md:w-12 md:h-12 object-contain group-hover:scale-105 transition-transform duration-300"
            />
            <div>
              <img
                src="/header-logo.png"
                alt="KR Fireworks"
                className="h-10 md:h-16 object-contain group-hover:scale-105 transition-transform"
              />
              <p className="text-[10px] md:text-xs text-red-600 font-medium group-hover:text-red-500 transition-colors">'n' joy with Every moments...</p>
            </div>
          </NavLink>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <NavLink to="/" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
              Home
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </NavLink>
            <NavLink to="/shop" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
              Products
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </NavLink>
            <NavLink to="/safety" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
              Safety
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </NavLink>
            <NavLink to="/contact" className="text-foreground hover:text-primary transition-all duration-300 font-medium relative group">
              Contact
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </NavLink>
          </div>

          {/* Cart, Auth & Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* Search Toggle */}
            <div className={`flex items-center transition-all duration-300 ease-in-out ${isSearchOpen ? 'w-full md:w-64 bg-white border border-input rounded-full shadow-sm px-3 py-1' : 'w-10'}`}>
              {isSearchOpen ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleManualSubmit();
                  }}
                  className="flex items-center w-full animate-in fade-in zoom-in duration-300"
                >
                  <Search className="w-4 h-4 text-muted-foreground mr-2 flex-shrink-0" />
                  <input
                    type="search"
                    placeholder="Search products, price, categories..."
                    className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground min-w-0 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      if (location.pathname === '/') {
                        handleSearch(val);
                      }
                    }}
                    onBlur={() => {
                      // Delay closing to allow click on X button
                      setTimeout(() => {
                        if (!searchQuery) setIsSearchOpen(false);
                      }, 200);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                      // Clear search
                      setSearchQuery("");
                      if (location.pathname === '/') {
                        navigate('/', { replace: true });
                      }
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </form>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} className="w-10 h-10 rounded-full">
                  <Search className="w-5 h-5 text-gray-700 hover:text-primary transition-colors" />
                </Button>
              )}
            </div>

            <CartDrawer />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden md:flex hover:bg-primary/10">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="w-4 h-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate("/auth")}
                className="hidden md:flex bg-gradient-gold hover:opacity-90 transition-opacity"
              >
                Sign In
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 space-y-2 animate-in slide-in-from-top duration-300">
            <NavLink to="/" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
              Home
            </NavLink>
            <NavLink to="/shop" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
              Products
            </NavLink>
            <NavLink to="/safety" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
              Safety
            </NavLink>
            <NavLink to="/contact" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
              Contact
            </NavLink>
            {user ? (
              <>
                <NavLink to="/profile" className="block py-2 text-foreground hover:text-primary transition-colors font-medium">
                  My Profile
                </NavLink>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="w-full justify-start"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button
                onClick={() => navigate("/auth")}
                className="w-full bg-gradient-gold hover:opacity-90 transition-opacity mt-2"
              >
                Sign In
              </Button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
