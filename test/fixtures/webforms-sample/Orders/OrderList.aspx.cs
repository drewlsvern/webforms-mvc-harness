namespace WebFormsSample.Orders
{
    public partial class OrderList : System.Web.UI.Page
    {
        private readonly IOrderPresenter presenter;

        protected void btnEdit_Click(object sender, EventArgs e)
        {
            Response.Redirect("OrderEdit.aspx");
        }
    }
}
